import cloudinaryService from '../services/cloudinaryService.js';
import Music from '../models/Music.js';

export async function uploadAudioAndStoreToDB(req, res) {
    try {
        const { title, artist } = req.body;
        const filePath = req.file.path;

        const cloudinaryUrl = await cloudinaryService.uploadAudio(filePath);

        const musicEntry = await Music.create({
            title,
            artist,
            cloudinaryUrl
        });

        res.status(201).json({ message: 'Audio uploaded and saved', data: musicEntry });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error uploading audio', error: error.message });
    }
}