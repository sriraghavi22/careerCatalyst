import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import cors from 'cors';
import individualRoutes from './routes/individualRoutes.js';
import institutionRoutes from './routes/institutionRoutes.js';
import organizationRoutes from './routes/organizationRoutes.js';
import jobRoutes from './routes/jobRoutes.js';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const app = express();

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// Serve static files from the 'Uploads' folder
app.use('/uploads', express.static(path.join(__dirname, 'Uploads')));

// Routes
app.use('/individuals', individualRoutes);
app.use('/institutions', institutionRoutes);
app.use('/organizations', organizationRoutes);
app.use('/institutions', jobRoutes); // Add job routes

// Database Connection
mongoose.connect(process.env.MONGO_URI, {
}).then(() => console.log('MongoDB Connected'))
  .catch(err => console.error(err));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));