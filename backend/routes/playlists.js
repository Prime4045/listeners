import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken, requireOwnership } from '../middleware/auth.js';
import Playlist from '../models/Playlist.js';
import User from '../models/User.js';

const router = express.Router();

router.get('/playlists', authenticateToken, async (req, res) => {
  try {
    const playlists = await Playlist.find({ owner: req.user._id })
      .populate('songs.song')
      .populate('owner');
    res.json(playlists);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch playlists', error: error.message });
  }
});

router.post(
  '/playlists',
  authenticateToken,
  [
    body('name').trim().notEmpty().isLength({ max: 100 }),
    body('description').optional().trim().isLength({ max: 500 }),
    body('isPublic').optional().isBoolean(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { name, description, isPublic } = req.body;
      const playlist = new Playlist({
        name,
        description,
        isPublic,
        owner: req.user._id,
      });
      await playlist.save();
      await User.findByIdAndUpdate(req.user._id, { $push: { playlists: playlist._id } });
      res.status(201).json(playlist);
    } catch (error) {
      res.status(500).json({ message: 'Failed to create playlist', error: error.message });
    }
  }
);

router.post(
  '/playlists/:id/songs',
  authenticateToken,
  requireOwnership(),
  async (req, res) => {
    try {
      const { songId } = req.body;
      const playlist = await Playlist.findById(req.params.id);
      await playlist.addSong(songId, req.user._id);
      res.json(playlist);
    } catch (error) {
      res.status(500).json({ message: 'Failed to add song', error: error.message });
    }
  }
);

router.delete(
  '/playlists/:id/songs/:songId',
  authenticateToken,
  requireOwnership(),
  async (req, res) => {
    try {
      const playlist = await Playlist.findById(req.params.id);
      await playlist.removeSong(req.params.songId);
      res.json(playlist);
    } catch (error) {
      res.status(500).json({ message: 'Failed to remove song', error: error.message });
    }
  }
);

export default router;