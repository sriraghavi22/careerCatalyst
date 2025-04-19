import React, { useState, useEffect } from 'react';
import { Plus, X, Trash2, FileText } from 'lucide-react';
import Sidebar from './Sidebar';

interface Job {
  _id: string;
  title: string;
  description: string;
  target_years: number[];
  target_departments: string[];
  created_at: string;
}

interface Student {
  _id: string;
  name: string;
  email: string;
  department: string;
  year: number;
  resume_url?: string;
  created_at: string;
}

interface ResumeMatch {
  student_id: string;
  job_id: string;
  match_score: number;
  student: Student;
  job: Job;
}

const Jobs = () => {
  const [showNewJobModal, setShowNewJobModal] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMatches, setShowMatches] = useState<string | null>(null);
  const [matches, setMatches] = useState<ResumeMatch[]>([]);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [newJob, setNewJob] = useState({
    title: '',
    description: '',
    target_years: [] as number[],
    target_departments: [] as string[]
  });

  const years = [1, 2, 3, 4];
  const departments = [
    'Computer Science and Engineering (CSE)',
    'CSE – Data Science (CSD)',
    'CSE – Artificial Intelligence and Machine Learning (CSM / AI & ML)',
    'Artificial Intelligence and Data Science (AI&DS)',
    'Information Technology (IT)',
    'Electronics and Communication Engineering (ECE)',
    'Electrical and Electronics Engineering (EEE)',
    'Mechanical Engineering',
    'Civil Engineering',
    'Chemical Engineering',
    'Biomedical Engineering',
    'Pharmaceutical Engineering'
  ];

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('No authentication token found');
        const response = await fetch('https://careercatalyst-node.onrender.com/institutions/api/jobs', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch jobs');
        const data = await response.json();
        setJobs(data.data || []);
      } catch (error) {
        console.error('Error fetching jobs:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchJobs();
  }, []);

  const fetchMatches = async (jobId: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token found');
      const response = await fetch(`https://careercatalyst-node.onrender.com/institutions/api/jobs/${jobId}/matches`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch matches');
      const data = await response.json();
      setMatches(data.data.sort((a: ResumeMatch, b: ResumeMatch) => 
        sortOrder === 'desc' ? b.match_score - a.match_score : a.match_score - b.match_score
      ));
      setShowMatches(jobId);
    } catch (error) {
      console.error('Error fetching matches:', error);
    }
  };

  const handleYearChange = (year: number) => {
    setNewJob({
      ...newJob,
      target_years: newJob.target_years.includes(year)
        ? newJob.target_years.filter(y => y !== year)
        : [...newJob.target_years, year]
    });
  };

  const handleDepartmentChange = (department: string) => {
    setNewJob({
      ...newJob,
      target_departments: newJob.target_departments.includes(department)
        ? newJob.target_departments.filter(d => d !== department)
        : [...newJob.target_departments, department]
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token found');
      if (newJob.target_years.length === 0 || newJob.target_departments.length === 0) {
        alert('Please select at least one year and one department');
        return;
      }
      const response = await fetch('https://careercatalyst-node.onrender.com/institutions/api/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: newJob.title,
          description: newJob.description,
          target_years: newJob.target_years,
          target_departments: newJob.target_departments
        })
      });
      if (!response.ok) throw new Error('Failed to create job');
      const newJobData = await response.json();
      setJobs([...jobs, newJobData.data]);
      setShowNewJobModal(false);
      setNewJob({
        title: '',
        description: '',
        target_years: [],
        target_departments: []
      });
    } catch (error) {
      console.error('Error creating job:', error);
      alert('Failed to create job');
    }
  };

  const handleDelete = async (jobId: string) => {
    if (window.confirm('Are you sure you want to delete this job?')) {
      try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('No authentication token found');
        const response = await fetch(`https://careercatalyst-node.onrender.com/institutions/api/jobs/${jobId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to delete job');
        setJobs(jobs.filter(job => job._id !== jobId));
      } catch (error) {
        console.error('Error deleting job:', error);
        alert('Failed to delete job');
      }
    }
  };

  const handleSortChange = (order: 'asc' | 'desc') => {
    setSortOrder(order);
    setMatches([...matches].sort((a, b) => 
      order === 'desc' ? b.match_score - a.match_score : a.match_score - b.match_score
    ));
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <nav className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 items-center">
              <div className="flex items-center">
                <h1 className="ml-2 text-xl font-semibold text-gray-900">Job Listings</h1>
              </div>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="space-y-6">
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-medium text-gray-900">Job Listings</h2>
                  <button
                    onClick={() => setShowNewJobModal(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    New Job
                  </button>
                </div>

                <div className="mt-8">
                  <div className="flex flex-col">
                    <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
                      <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
                        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                          <table className="min-w-full divide-y divide-gray-300">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                                  Job Title
                                </th>
                                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                  Description
                                </th>
                                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                  Target Years
                                </th>
                                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                  Target Departments
                                </th>
                                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                  Actions
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                              {loading ? (
                                <tr>
                                  <td colSpan={5} className="text-center py-4">Loading...</td>
                                </tr>
                              ) : jobs.length === 0 ? (
                                <tr>
                                  <td colSpan={5} className="text-center py-4">No jobs found</td>
                                </tr>
                              ) : (
                                jobs.map((job) => (
                                  <React.Fragment key={job._id}>
                                    <tr>
                                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                                        {job.title}
                                      </td>
                                      <td className="px-3 py-4 text-sm text-gray-500">
                                        {job.description}
                                      </td>
                                      <td className="px-3 py-4 text-sm text-gray-500">
                                        {job.target_years.join(', ')}
                                      </td>
                                      <td className="px-3 py-4 text-sm text-gray-500">
                                        {job.target_departments.join(', ')}
                                      </td>
                                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                        <button
                                          onClick={() => fetchMatches(job._id)}
                                          className="text-indigo-600 hover:text-indigo-900 mr-2"
                                        >
                                          View Matches
                                        </button>
                                        <button
                                          onClick={() => handleDelete(job._id)}
                                          className="text-red-600 hover:text-red-900"
                                        >
                                          <Trash2 className="h-5 w-5" />
                                        </button>
                                      </td>
                                    </tr>
                                    {showMatches === job._id && (
                                      <tr>
                                        <td colSpan={5} className="px-6 py-4">
                                          <div className="bg-gray-50 p-4 rounded-lg">
                                            <div className="flex justify-between items-center mb-4">
                                              <h3 className="text-lg font-medium">Top Matching Students</h3>
                                              <div className="flex items-center">
                                                <label htmlFor="sortOrder" className="mr-2 text-sm font-medium text-gray-700">Sort by Score:</label>
                                                <select
                                                  id="sortOrder"
                                                  value={sortOrder}
                                                  onChange={(e) => handleSortChange(e.target.value as 'asc' | 'desc')}
                                                  className="border border-gray-300 rounded-md shadow-sm py-1 px-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                                >
                                                  <option value="desc">High to Low</option>
                                                  <option value="asc">Low to High</option>
                                                </select>
                                                <button
                                                  onClick={() => setShowMatches(null)}
                                                  className="ml-4 text-gray-400 hover:text-gray-500"
                                                >
                                                  <X className="h-5 w-5" />
                                                </button>
                                              </div>
                                            </div>
                                            <div className="overflow-x-auto">
                                              <table className="min-w-full divide-y divide-gray-200">
                                                <thead>
                                                  <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                      Student Name
                                                    </th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                      Email
                                                    </th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                      Department
                                                    </th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                      Year
                                                    </th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                      Match Score
                                                    </th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                      Resume
                                                    </th>
                                                  </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200">
                                                  {matches.length === 0 ? (
                                                    <tr>
                                                      <td colSpan={6} className="text-center py-4 text-gray-500">
                                                        No matching students found.
                                                      </td>
                                                    </tr>
                                                  ) : (
                                                    matches.map((match) => (
                                                      <tr key={match.student_id}>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                          {match.student.name}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                          {match.student.email}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                          {match.student.department}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                          {match.student.year}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                          {Math.round(match.match_score)}%
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                          <a
                                                            href={match.student.resume_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-indigo-600 hover:text-indigo-900 flex items-center"
                                                          >
                                                            <FileText className="h-5 w-5 mr-1" />
                                                            View Resume
                                                          </a>
                                                        </td>
                                                      </tr>
                                                    ))
                                                  )}
                                                </tbody>
                                              </table>
                                            </div>
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </React.Fragment>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {showNewJobModal && (
              <div className="fixed z-10 inset-0 overflow-y-auto">
                <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                  <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>
                  <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
                    <form onSubmit={handleSubmit}>
                      <div>
                        <h3 className="text-lg leading-6 font-medium text-gray-900">Create New Job</h3>
                        <div className="mt-4 space-y-4">
                          <div>
                            <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                              Job Title
                            </label>
                            <input
                              type="text"
                              id="title"
                              value={newJob.title}
                              onChange={(e) => setNewJob({ ...newJob, title: e.target.value })}
                              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                              required
                            />
                          </div>
                          <div>
                            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                              Description
                            </label>
                            <textarea
                              id="description"
                              value={newJob.description}
                              onChange={(e) => setNewJob({ ...newJob, description: e.target.value })}
                              rows={3}
                              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              Target Years
                            </label>
                            <div className="mt-1 flex flex-wrap gap-2">
                              {years.map((year) => (
                                <label key={year} className="inline-flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={newJob.target_years.includes(year)}
                                    onChange={() => handleYearChange(year)}
                                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                  />
                                  <span className="ml-2 text-sm text-gray-700">Year {year}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              Target Departments
                            </label>
                            <div className="mt-1 flex flex-wrap gap-2">
                              {departments.map((department) => (
                                <label key={department} className="inline-flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={newJob.target_departments.includes(department)}
                                    onChange={() => handleDepartmentChange(department)}
                                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                  />
                                  <span className="ml-2 text-sm text-gray-700">{department}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                        <button
                          type="submit"
                          className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:col-start-2 sm:text-sm"
                        >
                          Create
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowNewJobModal(false)}
                          className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Jobs;
