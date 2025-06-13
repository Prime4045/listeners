import multer from 'multer';
import path from 'path';
import 'dotenv/config';

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/audio/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
    },
});

const fileFilter = (req, file, cb) => {
    const allowedFormats = JSON.parse(process.env.ALLOWED_AUDIO_FORMATS || '["mp3","wav","flac","m4a"]');
    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    if (allowedFormats.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file format. Allowed formats: ' + allowedFormats.join(', ')), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024,
    },
});

export default upload;