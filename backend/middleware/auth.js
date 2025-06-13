import 'dotenv/config';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { redisClient } from '../config/database.js';

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.header('Authorization');
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({ message: 'Invalid token - user not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    return res.status(500).json({ message: 'Token verification failed' });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.header('Authorization');
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');
      if (user) {
        req.user = user;
      }
    }
    next();
  } catch (error) {
    console.error('Optional auth error:', error);
    next();
  }
};

const requirePremium = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  if (req.user.subscription.type !== 'premium' ||
    (req.user.subscription.expiresAt && req.user.subscription.expiresAt < new Date())) {
    return res.status(403).json({
      message: 'Premium subscription required',
      upgradeUrl: '/premium',
    });
  }

  next();
};

const requireOwnership = (resourceField = 'owner') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const resource = req.resource || req.playlist || req.song;

    if (!resource) {
      return res.status(404).json({ message: 'Resource not found' });
    }

    const ownerId = resource[resourceField];
    if (ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied - insufficient permissions' });
    }

    next();
  };
};

const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

const generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d' }
  );
};

const validateRefreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token required' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    const storedToken = await redisClient.get(`refreshToken:${user._id}`);
    if (storedToken !== refreshToken) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Refresh token error:', error);
    return res.status(401).json({ message: 'Invalid refresh token' });
  }
};

export {
  authenticateToken,
  optionalAuth,
  requirePremium,
  requireOwnership,
  generateToken,
  generateRefreshToken,
  validateRefreshToken,
};