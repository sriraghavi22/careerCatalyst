import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from 'uuid';

const uploadDir = "uploads";
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = uuidv4(); // Temporary unique filename
        const ext = path.extname(file.originalname); // Get file extension
        cb(null, `${uniqueSuffix}${ext}`); // Save with temporary name
    }
});

const upload = multer({ storage });

export default upload;