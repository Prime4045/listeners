import express from 'express';
import { body, validationResult } from 'express-validator';
import passport from 'passport';
import { generateToken, generateRefreshToken, authenticateToken } from '../middleware/auth.js';
import { redisClient } from '../config/database.js';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = express.Router();

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('recentlyPlayed.song')
      .select('-password -googleId');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Get user error:', error.message);
    res.status(500).json({ message: 'Failed to get user', error: error.message });
  }
});

router.post(
  '/register',
  [
    body('username').trim().isLength({ min: 3, max: 30 }),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { username, email, password } = req.body;
      const existingUser = await User.findOne({ $or: [{ email }, { username }] });
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }

      const user = new User({ username, email, password });
      await user.save();

      const token = generateToken(user._id);
      const refreshToken = generateRefreshToken(user._id);
      await redisClient.setEx(`refreshToken:${user._id}`, 30 * 24 * 60 * 60, refreshToken);

      res.status(201).json({ token, refreshToken, user: user.toJSON() });
    } catch (error) {
      res.status(500).json({ message: 'Registration failed', error: error.message });
    }
  }
);

router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email });
      if (!user || !(await user.comparePassword(password))) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const token = generateToken(user._id);
      const refreshToken = generateRefreshToken(user._id);
      await redisClient.setEx(`refreshToken:${user._id}`, 30 * 24 * 60 * 60, refreshToken);

      user.lastLogin = new Date();
      await user.save();

      res.json({ token, refreshToken, user: user.toJSON() });
    } catch (error) {
      res.status(500).json({ message: 'Login failed', error: error.message });
    }
  }
);

router.post('/refresh-token', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    const storedToken = await redisClient.get(`refreshToken:${user._id}`);
    if (storedToken !== refreshToken) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    const newToken = generateToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);
    await redisClient.setEx(`refreshToken:${user._id}`, 30 * 24 * 60 * 60, newRefreshToken);

    res.json({ token: newToken, refreshToken: newRefreshToken });
  } catch (error) {
    res.status(401).json({ message: 'Token refresh failed', error: error.message });
  }
});

router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  async (req, res) => {
    const token = generateToken(req.user._id);
    const refreshToken = generateRefreshToken(req.user._id);
    await redisClient.setEx(`refreshToken:${req.user._id}`, 30 * 24 * 60 * 60, refreshToken);
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}&refreshToken=${refreshToken}`);
  }
);

export default router;