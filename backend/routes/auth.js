import express from 'express';
import { body, validationResult } from 'express-validator';
import passport from 'passport';
import { redisClient } from '../config/database.js';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import {
  generateToken,
  generateRefreshToken,
  authenticateToken,
  validateRefreshToken,
  blacklistToken,
  authLimiter,
  progressiveAuthLimiter,
  securityHeaders,
} from '../middleware/auth.js';

const router = express.Router();

// Email transporter setup (optional)
let transporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

// Apply security headers to all routes
router.use(securityHeaders);

// Input validation rules
const registerValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 20 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username must be 3-20 characters and contain only letters, numbers, and underscores'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must be at least 8 characters with 1 uppercase, 1 lowercase, 1 number, and 1 special character'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 30 })
    .withMessage('First name must be 2-30 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 30 })
    .withMessage('Last name must be 2-30 characters'),
  body('phoneNumber')
    .optional()
    .matches(/^\+[1-9]\d{1,14}$/)
    .withMessage('Phone number must be in international format (+1234567890)'),
];

const loginValidation = [
  body('emailOrUsername')
    .notEmpty()
    .withMessage('Email or username is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  body('rememberMe')
    .optional()
    .isBoolean(),
  body('mfaCode')
    .optional()
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('MFA code must be 6 digits'),
];

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('recentlyPlayed.song')
      .populate('likedSongs')
      .select('-password -mfaSecret -emailVerificationToken -passwordResetToken');

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    res.json({
      user,
      permissions: {
        canUpload: user.subscription.type === 'premium',
        canCreatePlaylists: true,
        maxPlaylists: user.subscription.type === 'premium' ? -1 : 10,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      message: 'Failed to get user',
      code: 'GET_USER_FAILED',
      error: error.message,
    });
  }
});

// User registration
router.post('/register', authLimiter, registerValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: errors.array(),
    });
  }

  try {
    const { username, email, password, firstName, lastName, phoneNumber } = req.body;

    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username }],
    });

    if (existingUser) {
      return res.status(409).json({
        message: existingUser.email === email.toLowerCase() ? 'Email already registered' : 'Username already taken',
        code: 'DUPLICATE_ENTRY',
        field: existingUser.email === email.toLowerCase() ? 'email' : 'username',
      });
    }

    const emailVerificationToken = crypto.randomBytes(32).toString('hex');

    const user = new User({
      username,
      email: email.toLowerCase(),
      password,
      firstName,
      lastName,
      phoneNumber,
      emailVerificationToken,
      isVerified: !transporter,
    });

    await user.save();

    if (transporter) {
      try {
        const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${emailVerificationToken}`;
        await transporter.sendMail({
          from: process.env.FROM_EMAIL,
          to: email,
          subject: 'Verify Your Email - Listeners',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #8b5cf6;">Welcome to Listeners!</h2>
              <p>Hi ${firstName || username},</p>
              <p>Thank you for registering with Listeners. Please verify your email address by clicking the button below:</p>
              <a href="${verificationUrl}" style="display: inline-block; background: #8b5cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Verify Email</a>
              <p>Or copy and paste this link in your browser:</p>
              <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
              <p>This link will expire in 24 hours.</p>
              <p>If you didn't create this account, please ignore this email.</p>
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
              <p style="color: #666; font-size: 12px;">© 2024 Listeners. All rights reserved.</p>
            </div>
          `,
        });
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
      }
    }

    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    try {
      await redisClient.setEx(`refreshToken:${user._id}`, 7 * 24 * 60 * 60, refreshToken);
    } catch (redisError) {
      console.warn('Redis set failed, continuing without refresh token storage:', redisError.message);
    }

    await user.addLoginHistory(req.ip, req.get('User-Agent'), true);

    req.skipRateLimit = true;

    res.status(201).json({
      message: transporter ? 'Registration successful. Please check your email to verify your account.' : 'Registration successful.',
      token,
      refreshToken,
      user: user.toJSON(),
      emailSent: !!transporter,
    });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(409).json({
        message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`,
        code: 'DUPLICATE_ENTRY',
        field,
      });
    }
    res.status(500).json({
      message: 'Registration failed',
      code: 'REGISTRATION_FAILED',
      error: error.message,
    });
  }
});

// User login
router.post('/login', progressiveAuthLimiter, loginValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: errors.array(),
    });
  }

  try {
    const { emailOrUsername, password, rememberMe, mfaCode } = req.body;

    const user = await User.findOne({
      $or: [{ email: emailOrUsername.toLowerCase() }, { username: emailOrUsername }],
    });

    if (!user) {
      return res.status(401).json({
        message: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
      });
    }

    if (user.isLocked) {
      return res.status(423).json({
        message: 'Account is temporarily locked due to multiple failed login attempts',
        code: 'ACCOUNT_LOCKED',
        lockUntil: user.lockUntil,
      });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      await user.incLoginAttempts();
      await user.addLoginHistory(req.ip, req.get('User-Agent'), false);

      return res.status(401).json({
        message: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
      });
    }

    if (user.mfaEnabled) {
      if (!mfaCode) {
        return res.status(200).json({
          message: 'MFA code required',
          code: 'MFA_REQUIRED',
          requiresMFA: true,
        });
      }

      const verified = speakeasy.totp.verify({
        secret: user.mfaSecret,
        encoding: 'base32',
        token: mfaCode,
        window: 2,
      });

      if (!verified) {
        await user.incLoginAttempts();
        await user.addLoginHistory(req.ip, req.get('User-Agent'), false);

        return res.status(401).json({
          message: 'Invalid MFA code',
          code: 'INVALID_MFA_CODE',
        });
      }
    }

    await user.resetLoginAttempts();

    const tokenExpiry = rememberMe ? '30d' : '15m';
    const token = generateToken(user._id, tokenExpiry);
    const refreshToken = generateRefreshToken(user._id);

    const refreshExpiry = rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60;
    try {
      await redisClient.setEx(`refreshToken:${user._id}`, refreshExpiry, refreshToken);
    } catch (redisError) {
      console.warn('Redis set failed, continuing without refresh token storage:', redisError.message);
    }

    user.lastLogin = new Date();
    await user.save();
    await user.addLoginHistory(req.ip, req.get('User-Agent'), true);

    req.skipRateLimit = true;

    if (rememberMe) {
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
    }

    res.json({
      message: 'Login successful',
      token,
      refreshToken,
      user: user.toJSON(),
      expiresIn: tokenExpiry,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      message: 'Login failed',
      code: 'LOGIN_FAILED',
      error: error.message,
    });
  }
});

// Refresh token
router.post('/refresh-token', validateRefreshToken, async (req, res) => {
  try {
    const { user, refreshToken: oldRefreshToken } = req;

    const newToken = generateToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    try {
      await redisClient.setEx(`refreshToken:${user._id}`, 7 * 24 * 60 * 60, newRefreshToken);
      await blacklistToken(oldRefreshToken, 7 * 24 * 60 * 60);
    } catch (redisError) {
      console.warn('Redis operations failed, continuing:', redisError.message);
    }

    res.json({
      message: 'Token refreshed successfully',
      token: newToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      message: 'Token refresh failed',
      code: 'TOKEN_REFRESH_FAILED',
      error: error.message,
    });
  }
});

// Logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const { refreshToken } = req.body;

    if (token) {
      await blacklistToken(token, 15 * 60);
    }
    if (refreshToken) {
      try {
        await redisClient.del(`refreshToken:${req.user._id}`);
        await blacklistToken(refreshToken, 7 * 24 * 60 * 60);
      } catch (redisError) {
        console.warn('Redis operations failed during logout:', redisError.message);
      }
    }

    req.logout((err) => {
      if (err) {
        console.error('Session logout error:', err);
      }
      req.session.destroy((err) => {
        if (err) {
          console.error('Session destroy error:', err);
        }
        res.clearCookie('refreshToken');
        res.clearCookie('connect.sid');
        res.json({
          message: 'Logout successful',
          code: 'LOGOUT_SUCCESS',
        });
      });
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      message: 'Logout failed',
      code: 'LOGOUT_FAILED',
      error: error.message,
    });
  }
});

// Email verification
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        message: 'Verification token is required',
        code: 'TOKEN_REQUIRED',
      });
    }

    const user = await User.findOne({ emailVerificationToken: token });

    if (!user) {
      return res.status(400).json({
        message: 'Invalid or expired verification token',
        code: 'INVALID_TOKEN',
      });
    }

    user.isVerified = true;
    user.emailVerificationToken = null;
    await user.save();

    res.json({
      message: 'Email verified successfully',
      code: 'EMAIL_VERIFIED',
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      message: 'Email verification failed',
      code: 'VERIFICATION_FAILED',
      error: error.message,
    });
  }
});

// Forgot password - Send reset email
router.post('/forgot-password', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: errors.array(),
    });
  }

  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({
        message: 'If an account with that email exists, a password reset link has been sent.',
        code: 'RESET_EMAIL_SENT',
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    user.passwordResetToken = resetToken;
    user.passwordResetExpires = resetTokenExpiry;
    await user.save();

    // Send reset email if transporter is configured
    if (transporter) {
      try {
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
        await transporter.sendMail({
          from: process.env.FROM_EMAIL,
          to: email,
          subject: 'Password Reset - Listeners',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #8b5cf6;">Password Reset Request</h2>
              <p>Hi ${user.firstName || user.username},</p>
              <p>You requested to reset your password. Click the button below to set a new password:</p>
              <a href="${resetUrl}" style="display: inline-block; background: #8b5cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Reset Password</a>
              <p>Or copy and paste this link in your browser:</p>
              <p style="word-break: break-all; color: #666;">${resetUrl}</p>
              <p>This link will expire in 1 hour.</p>
              <p>If you didn't request this, please ignore this email.</p>
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
              <p style="color: #666; font-size: 12px;">© 2024 Listeners. All rights reserved.</p>
            </div>
          `,
        });
      } catch (emailError) {
        console.error('Failed to send reset email:', emailError);
      }
    }

    res.json({
      message: 'If an account with that email exists, a password reset link has been sent.',
      code: 'RESET_EMAIL_SENT',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      message: 'Failed to process password reset request',
      code: 'RESET_REQUEST_FAILED',
      error: error.message,
    });
  }
});

// Reset password with token
router.post('/reset-password', [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must be at least 8 characters with 1 uppercase, 1 lowercase, 1 number, and 1 special character'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: errors.array(),
    });
  }

  try {
    const { token, newPassword } = req.body;

    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        message: 'Invalid or expired reset token',
        code: 'INVALID_RESET_TOKEN',
      });
    }

    // Update password
    user.password = newPassword;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();

    res.json({
      message: 'Password reset successfully',
      code: 'PASSWORD_RESET_SUCCESS',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      message: 'Failed to reset password',
      code: 'PASSWORD_RESET_FAILED',
      error: error.message,
    });
  }
});

// Google OAuth routes
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  router.get('/google', (req, res, next) => {
    req.session.redirectTo = req.query.redirect || '/dashboard';
    passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
  });

  router.get(
    '/google/callback',
    passport.authenticate('google', {
      failureRedirect: `${process.env.FRONTEND_URL}/signin?error=Oauth_failed&message=${encodeURIComponent('Authentication failed')}`,
      failureMessage: true,
    }),
    async (req, res) => {
      try {
        const user = req.user;
        if (!user) {
          console.error('Google callback: No user returned');
          return res.redirect(
            `${process.env.FRONTEND_URL}/signin?error=Oauth_failed&message=${encodeURIComponent('No user found')}`
          );
        }

        const token = generateToken(user._id);
        const refreshToken = generateRefreshToken(user._id);

        try {
          await redisClient.setEx(`refreshToken:${user._id}`, 7 * 24 * 60 * 60, refreshToken);
        } catch (redisError) {
          console.warn('Redis set failed during OAuth callback:', redisError.message);
        }

        await user.addLoginHistory(req.ip, req.get('User-Agent'), true);

        const redirectTo = req.session.redirectTo || '/dashboard';
        delete req.session.redirectTo;

        res.redirect(
          `${process.env.FRONTEND_URL}/auth/callback?token=${token}&refreshToken=${refreshToken}&redirect=${encodeURIComponent(
            redirectTo
          )}`
        );
      } catch (error) {
        console.error('Google OAuth callback error:', error);
        res.redirect(
          `${process.env.FRONTEND_URL}/signin?error=Oauth_failed&message=${encodeURIComponent(error.message || 'OAuth failed')}`
        );
      }
    }
  );
} else {
  console.warn('Google OAuth not configured: Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
  
  // Add placeholder routes to prevent 404 errors
  router.get('/google', (req, res) => {
    res.status(501).json({
      message: 'Google OAuth not configured',
      code: 'OAUTH_NOT_CONFIGURED'
    });
  });
  
  router.get('/google/callback', (req, res) => {
    res.redirect(`${process.env.FRONTEND_URL}/signin?error=oauth_not_configured`);
  });
}

export default router;