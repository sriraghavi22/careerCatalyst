from flask import Flask, request, jsonify, send_file, Blueprint
from resume_analyzer import AIResumeAnalyzer
from resume_job_matcher import ResumeJobMatcher
from flask_cors import CORS
from job_recommendation import get_job_listings
import os
import requests
import json
from fpdf import FPDF
from datetime import datetime
import math
import logging
import re
import PyPDF2
import uuid
from dotenv import load_dotenv
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__)
# Enable CORS for specific routes
CORS(app, resources={
    r"/report/*": {
        "origins": "http://localhost:5173",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"],
        "expose_headers": ["X-Report-FilePath"]
    },
    r"/Uploads/*": {
        "origins": "http://localhost:5173",
        "methods": ["GET", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    },
    r"/upload_resume": {
        "origins": "http://localhost:5173",
        "methods": ["POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    },
    r"/recommend-jobs": {
        "origins": "http://localhost:5173",
        "methods": ["POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    },
    r"/match_resume_job": {
        "origins": "http://localhost:5173",
        "methods": ["POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
}, supports_credentials=True)
analyzer = AIResumeAnalyzer()
matcher = ResumeJobMatcher()

# Define a blueprint for report generation
report_bp = Blueprint('report', __name__, url_prefix='/report')

# Function to extract text and hyperlinks from PDF
def extract_pdf_text_and_links(pdf_file):
    """
    Extracts text and hyperlinks from a PDF file, including annotations and embedded URLs.
    
    Args:
        pdf_file (file-like object): The PDF file object to extract text from.
    
    Returns:
        str: The extracted text including hyperlink URLs, or empty string if extraction fails.
    """
    logger.debug("Starting PDF text and hyperlink extraction")
    try:
        # Ensure the file pointer is at the start
        pdf_file.seek(0)
        
        # Initialize PyPDF2 reader
        reader = PyPDF2.PdfReader(pdf_file)
        extracted_text = []
        
        # Iterate through each page
        for page_num, page in enumerate(reader.pages):
            logger.debug(f"Processing page {page_num + 1}")
            
            # Extract plain text from the page
            page_text = page.extract_text() or ""
            if page_text:
                extracted_text.append(page_text)
            
            # Extract annotations (including hyperlinks)
            if "/Annots" in page:
                annotations = page["/Annots"]
                for annot in annotations:
                    annot_obj = annot.get_object()
                    if annot_obj.get("/Subtype") == "/Link" and "/A" in annot_obj:
                        action = annot_obj["/A"]
                        if "/URI" in action:
                            uri = action["/URI"]
                            logger.debug(f"Found hyperlink: {uri}")
                            extracted_text.append(uri)
        
        # Combine all extracted text and hyperlinks
        combined_text = "\n".join(extracted_text)
        if not combined_text.strip():
            logger.warning("No text or hyperlinks extracted from PDF")
            return ""
        
        logger.debug(f"Extracted text and hyperlinks: {combined_text[:100]}...")
        return combined_text
    
    except Exception as e:
        logger.error(f"Failed to extract text from PDF: {e}")
        return ""

# Utility Functions
def get_github_token():
    token = os.getenv('GITHUB_TOKEN')
    if not token:
        raise ValueError("GitHub token not found in environment variables")
    return token
    
def github_api_request(endpoint, token, params=None):
    base_url = "https://api.github.com"
    headers = {
        "Authorization": f"Bearer {token}",
        "User-Agent": "Mozilla/5.0"
    }
    response = requests.get(f"{base_url}{endpoint}", headers=headers, params=params)
    if response.status_code == 403:
        raise Exception("Rate limit exceeded or insufficient permissions. Check your token.")
    if response.status_code != 200:
        raise Exception(f"API request failed with status {response.status_code}: {response.text}")
    return response.json()

def fetch_user_repositories(username, token):
    logger.debug(f"Fetching repositories for username: {username}")
    repos_data = github_api_request(f"/users/{username}/repos", token, params={"per_page": 100})
    return [{"Name": repo["name"], "Language": repo["language"], "Languages URL": repo["languages_url"]} for repo in repos_data]

def fetch_repository_languages(languages_url, token):
    logger.debug(f"Fetching languages for URL: {languages_url}")
    endpoint = languages_url.replace("https://api.github.com", "")
    return github_api_request(endpoint, token)

def analyze_languages(repositories, token):
    languages_analysis = {}
    for repo in repositories:
        languages_url = repo.get("Languages URL")
        if languages_url:
            try:
                languages_data = fetch_repository_languages(languages_url, token)
                for language, bytes_written in languages_data.items():
                    languages_analysis[language] = languages_analysis.get(language, 0) + bytes_written
            except Exception as e:
                logger.error(f"Error fetching languages for repo {repo.get('Name')}: {e}")
    return languages_analysis

def extract_github_id(resume_text):
    """
    Extracts GitHub ID from resume text, searching for various formats including hyperlinks,
    labeled fields, or standalone usernames. Handles common variations and edge cases.
    
    Args:
        resume_text (str): The text extracted from the resume.
    
    Returns:
        str or None: The GitHub username if found, else None.
    """
    logger.debug(f"Extracting GitHub ID from resume text: {resume_text[:100]}...")
    
    # Comprehensive regex pattern to match GitHub IDs in various formats
    github_patterns = [
        r"(?:GitHub:\s*([a-zA-Z0-9-]+)|https://github.com/([a-zA-Z0-9-]+))",  # https://github.com/username or github.com/username
    ]
    
    # Combine patterns with OR
    combined_pattern = '|'.join(f'({pattern})' for pattern in github_patterns)
    
    # Search for matches
    matches = re.finditer(combined_pattern, resume_text, re.IGNORECASE)
    
    for match in matches:
        # Check each group for a valid GitHub ID
        for group in match.groups():
            if group and re.match(r"^[a-zA-Z0-9-]+$", group):
                logger.debug(f"Found GitHub ID: {group}")
                return group
    
    logger.warning("No GitHub ID found in resume")
    return None

def safe_log(value, base):
    return math.log(value + 1, base)

def compute_github_rating(github_data):
    summary = github_data.get("summary_statistics", {})
    total_commits = summary.get("total_commits", 0)
    total_repos = summary.get("total_repositories", 0)
    total_workflows = summary.get("total_workflows", 0)
    total_prs = summary.get("total_pull_requests", 0)

    max_commits, max_repos, max_workflows, max_prs = 50, 20, 100, 10
    norm_commits = min(safe_log(total_commits, max_commits + 1) / safe_log(max_commits, max_commits + 1) * 10, 10)
    norm_repos = min(safe_log(total_repos, max_repos + 1) / safe_log(max_repos, max_repos + 1) * 10, 10)
    norm_workflows = min(safe_log(total_workflows, max_workflows + 1) / safe_log(max_workflows, max_workflows + 1) * 10, 10)
    norm_prs = min(safe_log(total_prs, max_prs + 1) / safe_log(max_prs, max_prs + 1) * 10, 10)
    return min((norm_commits * 0.35 + norm_repos * 0.25 + norm_workflows * 0.2 + norm_prs * 0.2), 10)

def combine_ratings(github_rating, offered_salary, min_salary, max_salary):
    salary_factor = min((offered_salary - min_salary) / (max_salary - min_salary) * 5, 5)
    return min(github_rating + salary_factor, 10)

def map_rating_to_salary(rating, min_salary, max_salary):
    """
    Map a candidate's GitHub rating (0 to 10) to a salary range using linear interpolation.
    
    Args:
        rating (float): The GitHub rating from 0 to 10.
        min_salary (float): The minimum salary in LPA.
        max_salary (float): The maximum salary in LPA.
    
    Returns:
        float: The interpolated salary based on the rating.
    """
    return min_salary + (max_salary - min_salary) * (rating / 10)

def format_bytes(bytes_count):
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes_count < 1024:
            return f"{bytes_count:.1f} {unit}"
        bytes_count /= 1024
    return f"{bytes_count:.1f} TB"

def draw_language_bar(pdf, language, bytes_written, max_bytes, start_y):
    """
    Draw a language usage bar without forcing a new page unless necessary.
    """
    bar_width, bar_height, left_margin = 160, 12, 30
    # Check if there's enough space for the bar (including padding)
    if start_y + bar_height + 5 > pdf.h - pdf.b_margin:
        pdf.add_page()
        start_y = pdf.t_margin  # Reset to top margin of new page
    start_x = pdf.l_margin + left_margin
    percentage = (bytes_written / max_bytes) * 100
    actual_bar_width = (bytes_written / max_bytes) * bar_width
    pdf.set_xy(pdf.l_margin + 2, start_y + 2)
    pdf.set_font('helvetica', 'B', 10)
    pdf.cell(left_margin - 5, bar_height, language, ln=0, align='R')
    pdf.set_fill_color(240, 240, 240)
    pdf.rect(start_x, start_y, bar_width, bar_height, style='F')
    pdf.set_fill_color(41, 128, 185)
    if actual_bar_width > 0:
        pdf.rect(start_x, start_y, actual_bar_width, bar_height, style='F')
    stats_text = f"{percentage:.1f}% ({format_bytes(bytes_written)})"
    text_width = pdf.get_string_width(stats_text)
    text_x = start_x + 5
    if actual_bar_width > text_width + 10:
        pdf.set_text_color(255, 255, 255)
    else:
        pdf.set_text_color(0, 0, 0)
    pdf.set_xy(text_x, start_y + 2)
    pdf.set_font('helvetica', '', 10)
    pdf.cell(bar_width - 10, bar_height - 4, stats_text, ln=1)
    pdf.set_text_color(0, 0, 0)
    return start_y + bar_height + 1  # Return new Y position

class PDFReport(FPDF):
    def header(self):
        self.set_font("helvetica", "B", 16)
        self.set_text_color(50, 50, 50)
        self.cell(0, 10, "Developer Report", border=0, ln=1, align="C")
        self.image("https://cdn-icons-png.flaticon.com/512/3891/3891670.png", x=10, y=10, w=30)
        self.ln(15)

    def footer(self):
        self.set_y(-15)
        self.set_font("helvetica", "I", 8)
        self.set_text_color(128, 128, 128)
        self.cell(0, 10, f"Page {self.page_no()} | OrgDash Enterprise", 0, 0, "C")

def section_header(pdf, title):
    pdf.set_font("helvetica", "B", 14)
    pdf.set_text_color(255, 255, 255)
    pdf.set_fill_color(0, 102, 204)
    pdf.cell(0, 10, title, ln=1, fill=True, align="C")
    pdf.ln(3)

# Serve files from the uploads folder
@app.route('/Uploads/<path:filename>', methods=['GET'])
def serve_uploaded_file(filename):
    upload_folder = os.path.join(os.path.dirname(__file__), 'Uploads')
    file_path = os.path.join(upload_folder, filename)
    if not os.path.exists(file_path):
        logger.error(f"File not found: {file_path}")
        return jsonify({"error": "File not found"}), 404
    logger.debug(f"Serving file: {file_path}")
    return send_file(file_path, mimetype='application/pdf')

# Custom OPTIONS route to handle CORS preflight for uploads
@app.route('/Uploads/<path:filename>', methods=['OPTIONS'])
def options_uploads(filename):
    logger.debug(f"Handling OPTIONS request for /Uploads/{filename}")
    response = app.make_default_options_response()
    response.headers['Access-Control-Allow-Origin'] = 'http://localhost:5173'
    response.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response, 200

# Custom OPTIONS route to handle CORS preflight for report
@report_bp.route('/generate-report', methods=['OPTIONS'])
def options_report():
    logger.debug("Handling OPTIONS request for /report/generate-report")
    response = app.make_default_options_response()
    response.headers['Access-Control-Allow-Origin'] = 'http://localhost:5173'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    response.headers['Access-Control-Expose-Headers'] = 'X-Report-FilePath'
    return response, 200

# Custom OPTIONS route to handle CORS preflight for upload_resume
@app.route('/upload_resume', methods=['OPTIONS'])
def options_upload_resume():
    logger.debug("Handling OPTIONS request for /upload_resume")
    response = app.make_default_options_response()
    response.headers['Access-Control-Allow-Origin'] = 'http://localhost:5173'
    response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response, 200

# Custom OPTIONS route to handle CORS preflight for recommend-jobs
@app.route('/recommend-jobs', methods=['OPTIONS'])
def options_recommend_jobs():
    logger.debug("Handling OPTIONS request for /recommend-jobs")
    response = app.make_default_options_response()
    response.headers['Access-Control-Allow-Origin'] = 'http://localhost:5173'
    response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response, 200

# Custom OPTIONS route to handle CORS preflight for match_resume_job
@app.route('/match_resume_job', methods=['OPTIONS'])
def options_match_resume_job():
    logger.debug("Handling OPTIONS request for /match_resume_job")
    response = app.make_default_options_response()
    response.headers['Access-Control-Allow-Origin'] = 'http://localhost:5173'
    response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response, 200

# Report Generation Route
@report_bp.route('/generate-report', methods=['POST'])
def generate_report():
    data = request.get_json()
    logger.debug(f"Received request data: {data}")
    resume_file_path = data.get('resumeFilePath')
    min_salary = data.get('min_salary')
    max_salary = data.get('max_salary')

    if not resume_file_path:
        logger.error("resumeFilePath is missing in request")
        return jsonify({"error": "resumeFilePath is required"}), 400

    if min_salary is None or max_salary is None:
        logger.error("min_salary and max_salary are required")
        return jsonify({"error": "Both min_salary and max_salary are required"}), 400

    if min_salary >= max_salary:
        logger.error("min_salary must be less than max_salary")
        return jsonify({"error": "min_salary must be less than max_salary"}), 400

    try:
        # Construct full path for resume
        full_path = os.path.join(os.path.dirname(__file__), resume_file_path.lstrip('/'))
        logger.debug(f"Constructed resume full path: {full_path}")

        # Check if resume file exists
        if not os.path.exists(full_path):
            logger.error(f"Resume file not found at {full_path}")
            return jsonify({"error": f"Resume file not found at {full_path}"}), 400

        # Read and parse the resume
        logger.debug(f"Attempting to extract text from {full_path}")
        with open(full_path, 'rb') as pdf_file:
            resume_text = extract_pdf_text_and_links(pdf_file)
        if not resume_text:
            logger.error(f"Failed to extract text from {full_path}")
            return jsonify({"error": "Failed to extract text from resume"}), 400

        # Extract GitHub ID from resume
        github_id = extract_github_id(resume_text)
        if not github_id:
            logger.error("No GitHub ID found in resume")
            return jsonify({"error": "No GitHub ID found in resume"}), 400

        # Fetch GitHub data
        token = get_github_token()
        repositories = fetch_user_repositories(github_id, token)
        languages_analysis = analyze_languages(repositories, token)
        summary_stats = {
            "total_repositories": len(repositories),
            "total_commits": sum(repo.get("commit_count", 0) for repo in repositories if "commit_count" in repo) or 0,
            "total_pull_requests": sum(repo.get("pull_request_count", 0) for repo in repositories if "pull_request_count" in repo) or 0,
            "total_workflows": sum(repo.get("workflow_count", 0) for repo in repositories if "workflow_count" in repo) or 0
        }
        all_repos_skills = {repo["Language"]: sum(1 for r in repositories if r["Language"] == repo["Language"]) for repo in repositories if repo["Language"]}
        user_owned_repos = [repo for repo in repositories if not repo.get("fork", False)]
        user_owned_repos_skills = {repo["Language"]: sum(1 for r in user_owned_repos if r["Language"] == repo["Language"]) for repo in user_owned_repos if repo["Language"]}
        user_owned_repos_languages = {k: v for k, v in languages_analysis.items() if any(k == repo["Language"] for repo in user_owned_repos)}

        github_rating = compute_github_rating({"summary_statistics": summary_stats})
        offered_salary = map_rating_to_salary(github_rating, min_salary, max_salary)
        overall_rating = github_rating  # No additional salary factor since salary is derived from rating

        pdf = PDFReport()
        pdf.add_page()
        pdf.set_auto_page_break(auto=True, margin=20)

        pdf.set_font("helvetica", "", 12)
        pdf.cell(0, 10, f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", ln=1, align="C")
        pdf.ln(5)

        section_header(pdf, "GitHub Summary Statistics")
        pdf.set_text_color(0, 0, 0)
        pdf.cell(0, 8, f"Total Repositories: {summary_stats['total_repositories']}", ln=1)
        pdf.cell(0, 8, f"Total Commits: {summary_stats['total_commits']}", ln=1)
        pdf.cell(0, 8, f"Total Pull Requests: {summary_stats['total_pull_requests']}", ln=1)
        pdf.cell(0, 8, f"Total Workflows: {summary_stats['total_workflows']}", ln=1)
        pdf.ln(5)

        section_header(pdf, "Skills Analysis (All Repositories)")
        pdf.set_text_color(0, 0, 0)
        for skill, count in all_repos_skills.items():
            pdf.cell(0, 8, f"{skill}: {count} repositories", ln=1)
        pdf.ln(5)

        section_header(pdf, "Languages Used (All Repositories)")
        pdf.set_text_color(0, 0, 0)
        if languages_analysis:
            pdf.set_font("helvetica", "B", 12)
            pdf.cell(0, 8, "Language Distribution:", ln=1)
            pdf.ln(5)
            max_bytes = max(languages_analysis.values())
            current_y = pdf.get_y()
            for lang, bytes_written in sorted(languages_analysis.items(), key=lambda x: x[1], reverse=True):
                current_y = draw_language_bar(pdf, lang, bytes_written, max_bytes, current_y)
        else:
            pdf.cell(0, 8, "No data available.", ln=1)
        pdf.ln(5)

        pdf.add_page()
        section_header(pdf, "Skills Analysis (User-Owned Repositories)")
        pdf.set_text_color(0, 0, 0)
        for skill, count in user_owned_repos_skills.items():
            pdf.cell(0, 8, f"{skill}: {count} repositories", ln=1)
        pdf.ln(5)

        section_header(pdf, "Languages Used (User-Owned Repositories)")
        pdf.set_text_color(0, 0, 0)
        if user_owned_repos_languages:
            pdf.set_font("helvetica", "B", 12)
            pdf.cell(0, 8, "Language Distribution:", ln=1)
            pdf.ln(5)
            max_bytes = max(user_owned_repos_languages.values())
            current_y = pdf.get_y()
            for lang, bytes_written in sorted(user_owned_repos_languages.items(), key=lambda x: x[1], reverse=True):
                current_y = draw_language_bar(pdf, lang, bytes_written, max_bytes, current_y)
        else:
            pdf.cell(0, 8, "No data available.", ln=1)
        pdf.ln(5)

        section_header(pdf, "Candidate Evaluation")
        pdf.set_text_color(0, 0, 0)
        pdf.set_font("helvetica", "", 12)
        pdf.cell(0, 8, f"GitHub Rating: {github_rating:.2f}/10", ln=1)
        pdf.cell(0, 8, f"Suggested Salary: {offered_salary:.2f} LPA (Based on rating between {min_salary} and {max_salary} LPA)", ln=1)
        pdf.cell(0, 8, f"Overall Rating: {overall_rating:.2f}/10", ln=1)

        # Save the report to the Uploads folder
        upload_folder = os.path.join(os.path.dirname(__file__), 'Uploads')
        if not os.path.exists(upload_folder):
            os.makedirs(upload_folder)
        report_filename = f"report_{github_id}_{uuid.uuid4().hex[:8]}.pdf"
        pdf_output = os.path.join(upload_folder, report_filename)
        pdf.output(pdf_output)
        logger.debug(f"Report saved to: {pdf_output}")

        # Return the file path and the file itself
        response = send_file(pdf_output, as_attachment=True, download_name=f"report_{github_id}.pdf", mimetype="application/pdf")
        response.headers['Access-Control-Allow-Origin'] = 'http://localhost:5173'
        response.headers['Access-Control-Expose-Headers'] = 'X-Report-FilePath'
        response.headers['X-Report-FilePath'] = f"/Uploads/{report_filename}"
        logger.debug(f"Set X-Report-FilePath header: /Uploads/{report_filename}")
        return response
    except Exception as e:
        logger.error(f"Error in generate_report: {str(e)}")
        return jsonify({"error": str(e)}), 500

# Register the blueprint
app.register_blueprint(report_bp, url_prefix='/report')

@app.route('/upload_resume', methods=['POST'])
def upload_resume():
    if 'resume' not in request.files:
        logger.error("No file part in request")
        return jsonify({"error": "No file part"}), 400
    file = request.files['resume']
    job_category = request.args.get('job_category')
    job_role = request.args.get('job_role')
    
    logger.debug(f"Uploading resume with job_category: {job_category}, job_role: {job_role}")
    
    # Save the file to disk
    upload_folder = os.path.join(os.path.dirname(__file__), 'Uploads')
    if not os.path.exists(upload_folder):
        os.makedirs(upload_folder)
    # Use a unique filename to avoid conflicts
    filename = f"resume_{uuid.uuid4().hex[:8]}_{file.filename}"
    file_path = os.path.join(upload_folder, filename)
    file.save(file_path)
    logger.debug(f"Resume saved to: {file_path}")
    
    # Rewind the file pointer or re-open the file
    file.seek(0)
    resume_text = analyzer.extract_text_from_pdf(file)
    if not resume_text:
        logger.error("Failed to extract text from PDF")
        return jsonify({"error": "Failed to extract text from PDF"}), 400
    
    analysis_result = analyzer.analyze_resume_with_gemini(resume_text, job_role=job_role if job_role else None)
    logger.debug(f"Resume analysis result: {analysis_result}")
    
    response = jsonify({"filePath": f"/Uploads/{filename}", **analysis_result})
    response.headers['Access-Control-Allow-Origin'] = 'http://localhost:5173'
    return response

@app.route('/recommend-jobs', methods=['POST'])
def recommend_jobs():
    data = request.get_json()
    search_query = data.get("search_query", "")
    
    if not search_query:
        logger.error("Search query is required")
        return jsonify({"error": "Search query is required"}), 400

    jobs = get_job_listings(search_query)
    logger.debug(f"Job listings: {jobs}")
    response = jsonify(jobs)
    response.headers['Access-Control-Allow-Origin'] = 'http://localhost:5173'
    return response

@app.route('/match_resume_job', methods=['POST'])
def match_resume_job():
    data = request.get_json()
    logger.debug(f"Received request data: {data}")
    resume_file_path = data.get('resumeFilePath')
    job_description = data.get('jobDescription')
    job_role = data.get('jobRole')

    if not resume_file_path:
        logger.error("resumeFilePath is missing in request")
        return jsonify({"error": "resumeFilePath is required"}), 400

    if not job_description:
        logger.error("jobDescription is missing in request")
        return jsonify({"error": "jobDescription is required"}), 400

    try:
        # Construct full path for resume
        full_path = os.path.join(os.path.dirname(__file__), resume_file_path.lstrip('/'))
        logger.debug(f"Constructed resume full path: {full_path}")

        # Check if resume file exists
        if not os.path.exists(full_path):
            logger.error(f"Resume file not found at {full_path}")
            return jsonify({"error": f"Resume file not found at {full_path}"}), 400

        # Match resume to job
        logger.debug(f"Matching resume at {full_path} to job description")
        match_result = matcher.match_resume_to_job(full_path, job_description, job_role)
        
        if "error" in match_result:
            logger.error(f"Matching failed: {match_result['error']}")
            return jsonify({"error": match_result['error']}), 400

        logger.debug(f"Match result: {match_result}")
        response = jsonify(match_result)
        response.headers['Access-Control-Allow-Origin'] = 'http://localhost:5173'
        return response

    except Exception as e:
        logger.error(f"Error in match_resume_job: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)