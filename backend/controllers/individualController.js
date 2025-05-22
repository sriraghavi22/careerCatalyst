import Individual from '../models/Individual.js';
import Institution from '../models/Institution.js'; // Import Institution model to fetch colleges
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { spawn } from 'child_process';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const uploadDir = "uploads"; // Define uploadDir constant

// Register Individual
export const registerIndividual = async (req, res) => {
    try {
        // console.log('Received req.body:', req.body); // Debug log
        const { name, email, password, college, year, department } = req.body;
        const existingUser = await Individual.findOne({ email });
        if (existingUser) return res.status(400).json({ message: 'User already exists' });

        const institution = await Institution.findById(college);
        if (!institution) return res.status(400).json({ message: 'Invalid college ID' });

        if (!req.file) {
            return res.status(400).json({ message: 'Resume file is required' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new Individual({ 
            name, 
            email, 
            password: hashedPassword, 
            college, 
            year, 
            department,
            resumeFilePath: req.file.path // Temporary path
        });

        await newUser.save();
        const oldFilePath = req.file.path;
        const ext = path.extname(oldFilePath);
        const newFilePath = path.join(uploadDir, `${newUser._id}${ext}`); // Use _id as filename
        fs.renameSync(oldFilePath, newFilePath); // Rename file to use _id
        newUser.resumeFilePath = newFilePath; // Update with new path
        await newUser.save();

        res.status(201).json({ 
            message: 'User registered successfully', 
            user: { name, email, college, year, department, resumeFilePath: newUser.resumeFilePath } 
        });
    } catch (error) {
        console.error('Registration Error:', error.message);
        // Clean up the uploaded file if an error occurs
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ message: error.message });
    }
};

// Login Individual
export const loginIndividual = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await Individual.findOne({ email }).populate('college', 'name');
        if (!user) return res.status(400).json({ message: 'User not found' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.json({ 
            token, 
            user: { 
                name: user.name, 
                email: user.email, 
                college: user.college ? user.college.name : null, 
                year: user.year, 
                department: user.department, 
                resumeFilePath: user.resumeFilePath 
            } 
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const uploadPDF = async (req, res) => {
    try {
        const { id } = req.params;
        if (req.user.id.toString() !== id.toString()) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const user = await Individual.findById(id);
        if (!user) return res.status(404).json({ message: "User not found" });

        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }
        user.resumeFilePath = req.file.path;
        await user.save();

        res.status(200).json({ message: "PDF uploaded successfully", filePath: req.file.path });
    } catch (error) {
        console.error("Upload Error:", error.message);
        res.status(500).json({ message: error.message });
    }
};

// Delete PDF
export const deletePDF = async (req, res) => {
    try {
        const { id } = req.params;
        if (req.user.id.toString() !== id.toString()) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const user = await Individual.findById(id);
        if (!user) return res.status(404).json({ message: "User not found" });

        const filePath = path.join("uploads", `${id}.pdf`);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        } else {
            return res.status(404).json({ message: "File not found" });
        }

        user.resumeFilePath = null;
        await user.save();

        res.status(200).json({ message: "PDF deleted successfully" });
    } catch (error) {
        console.error("Delete Error:", error.message);
        res.status(500).json({ message: error.message });
    }
};