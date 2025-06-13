import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();

router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('likedSongs')
      .populate('playlists')
      .populate('followedArtists');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch profile', error: error.message });
  }
});

router.put(
  '/profile',
  authenticateToken,
  [
    body('username').optional().trim().isLength({ min: 3, max: 30 }),
    body('email').optional().isEmail().normalizeEmail(),
    body('preferences.theme').optional().isIn(['dark', 'light']),
    body('preferences.autoplay').optional().isBoolean(),
    body('preferences.quality').optional().isIn(['low', 'medium', 'high']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const updates = req.body;
      const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select('-password');
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update profile', error: error.message });
    }
  }
);

export default router;