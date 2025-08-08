import 'dotenv/config';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import User from '../models/User.js';
import { redisClient } from '../config/database.js';
import crypto from 'crypto';

// More lenient rate limiting for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Increased from 5 to 10 attempts per window
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: 15 * 60 * 1000,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip + ':' + (req.body.email || req.body.username || 'unknown');
  },
  skip: (req) => {
    // Skip rate limiting for successful requests
    return req.skipRateLimit === true;
  },
});

// Progressive rate limiting for failed login attempts
export const progressiveAuthLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: (req) => {
    const attempts = req.user?.loginAttempts || 0;
    if (attempts >= 3) return 5; // Increased from 1 to 5 attempts per hour after 3 failures
    if (attempts >= 2) return 8; // Increased from 3 to 8 attempts per hour after 2 failures
    return 20; // Increased from 10 to 20 attempts per hour initially
  },
  message: {
    error: 'Account temporarily locked due to multiple failed login attempts.',
    retryAfter: 60 * 60 * 1000,
  },
  keyGenerator: (req) => {
    return req.body.email || req.body.username || req.ip;
  },
});

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.header('Authorization');
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        message: 'Access token required',
        code: 'TOKEN_MISSING'
      });
    }

    // Check if token is blacklisted
    try {
      const isBlacklisted = await redisClient.get(`blacklist:${token}`);
      if (isBlacklisted) {
        return res.status(401).json({
          message: 'Token has been revoked',
          code: 'TOKEN_REVOKED'
        });
      }
    } catch (redisError) {
      console.warn('Redis check failed, continuing without blacklist check:', redisError.message);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password -mfaSecret');

    if (!user) {
      return res.status(401).json({
        message: 'Invalid token - user not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Check if account is locked
    if (user.isLocked) {
      return res.status(423).json({
        message: 'Account is temporarily locked due to multiple failed login attempts',
        code: 'ACCOUNT_LOCKED',
        lockUntil: user.lockUntil
      });
    }

    // Check if email is verified for sensitive operations
    if (!user.isVerified && req.path.includes('/sensitive')) {
      return res.status(403).json({
        message: 'Email verification required',
        code: 'EMAIL_NOT_VERIFIED'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Token verification error:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        message: 'Invalid token',
        code: 'TOKEN_INVALID'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        message: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    return res.status(500).json({
      message: 'Token verification failed',
      code: 'TOKEN_VERIFICATION_FAILED'
    });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.header('Authorization');
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password -mfaSecret');
        if (user && !user.isLocked) {
          req.user = user;
        }
      } catch (error) {
        // Silently fail for optional auth
        console.log('Optional auth failed:', error.message);
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
    return res.status(401).json({
      message: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  if (
    req.user.subscription.type !== 'premium' ||
    (req.user.subscription.expiresAt && req.user.subscription.expiresAt < new Date())
  ) {
    return res.status(403).json({
      message: 'Premium subscription required',
      code: 'PREMIUM_REQUIRED',
      upgradeUrl: '/premium',
    });
  }

  next();
};

const requireOwnership = (resourceField = 'owner') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const resource = req.resource || req.playlist || req.song;

    if (!resource) {
      return res.status(404).json({
        message: 'Resource not found',
        code: 'RESOURCE_NOT_FOUND'
      });
    }

    const ownerId = resource[resourceField];
    if (ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'Access denied - insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    next();
  };
};

const generateToken = (userId, expiresIn = '15m') => {
  return jwt.sign(
    {
      userId,
      type: 'access',
      iat: Math.floor(Date.now() / 1000)
    },
    process.env.JWT_SECRET,
    { expiresIn }
  );
};

const generateRefreshToken = (userId) => {
  const refreshToken = jwt.sign(
    {
      userId,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000),
      jti: crypto.randomUUID()
    },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
  return refreshToken;
};

const validateRefreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        message: 'Refresh token required',
        code: 'REFRESH_TOKEN_MISSING'
      });
    }

    // Check if refresh token is blacklisted
    try {
      const isBlacklisted = await redisClient.get(`blacklist:${refreshToken}`);
      if (isBlacklisted) {
        return res.status(401).json({
          message: 'Refresh token has been revoked',
          code: 'REFRESH_TOKEN_REVOKED'
        });
      }
    } catch (redisError) {
      console.warn('Redis check failed, continuing without blacklist check:', redisError.message);
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.userId).select('-password -mfaSecret');

    if (!user) {
      return res.status(401).json({
        message: 'Invalid refresh token - user not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Check if the refresh token exists in Redis
    try {
      const storedToken = await redisClient.get(`refreshToken:${user._id}`);
      if (storedToken !== refreshToken) {
        return res.status(401).json({
          message: 'Invalid refresh token',
          code: 'REFRESH_TOKEN_INVALID'
        });
      }
    } catch (redisError) {
      console.warn('Redis token check failed, continuing:', redisError.message);
    }

    req.user = user;
    req.refreshToken = refreshToken;
    next();
  } catch (error) {
    console.error('Refresh token error:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        message: 'Invalid refresh token',
        code: 'REFRESH_TOKEN_INVALID'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        message: 'Refresh token expired',
        code: 'REFRESH_TOKEN_EXPIRED'
      });
    }

    return res.status(401).json({
      message: 'Refresh token validation failed',
      code: 'REFRESH_TOKEN_VALIDATION_FAILED'
    });
  }
};

// Blacklist token on logout
const blacklistToken = async (token, expiresIn = 15 * 60) => {
  try {
    await redisClient.setEx(`blacklist:${token}`, expiresIn, 'true');
  } catch (error) {
    console.error('Error blacklisting token:', error);
  }
};

// CSRF Protection
const csrfProtection = (req, res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const token = req.headers['x-csrf-token'] || req.body._csrf;
    const sessionToken = req.session?.csrfToken;

    if (!token || !sessionToken || token !== sessionToken) {
      return res.status(403).json({
        message: 'Invalid CSRF token',
        code: 'CSRF_TOKEN_INVALID'
      });
    }
  }
  next();
};

// Security headers middleware
const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
};

export {
  authenticateToken,
  optionalAuth,
  requirePremium,
  requireOwnership,
  generateToken,
  generateRefreshToken,
  validateRefreshToken,
  blacklistToken,
  csrfProtection,
  securityHeaders,
};