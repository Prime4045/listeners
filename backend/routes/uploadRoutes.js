import express from 'express';
import multer from 'multer';
import { uploadAudioAndStoreToDB } from '../controllers/uploadController.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.post('/upload-audio', upload.single('audio'), uploadAudioAndStoreToDB);

export default router;