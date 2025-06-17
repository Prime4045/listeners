import express from 'express';
import { body, validationResult } from 'express-validator';
import passport from 'passport';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import {
  generateToken,
  generateRefreshToken,
  authenticateToken,
  validateRefreshToken,
  blacklistToken,
  authLimiter,
  progressiveAuthLimiter,
  securityHeaders
} from '../middleware/auth.js';
import { redisClient } from '../config/database.js';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = express.Router();

// Apply security headers to all routes
router.use(securityHeaders);

// Email transporter setup
const transporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

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
      .select('-password -mfaSecret -emailVerificationToken -passwordResetToken');

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }
    res.json({
      user,
      permissions: {
        canUpload: user.subscription.type === 'premium',
        canCreatePlaylists: true,
        maxPlaylists: user.subscription.type === 'premium' ? -1 : 10,
      }
    });
  } catch (error) {
    console.error('Get user error:', error.message);
    res.status(500).json({
      message: 'Failed to get user',
      code: 'GET_USER_FAILED',
      error: error.message
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
      errors: errors.array()
    });
  }

  try {
    const {
      username,
      email,
      password,
      firstName,
      lastName,
      phoneNumber
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(409).json({
        message: existingUser.email === email ? 'Email already registered' : 'Username already taken',
        code: 'USER_EXISTS'
      });
    }

    // Generate email verification token
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');

    // Create new user
    const user = new User({
      username,
      email,
      password,
      firstName,
      lastName,
      phoneNumber,
      emailVerificationToken
    });

    await user.save();

    // Send verification email
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
      // Don't fail registration if email fails
    }

    // Generate tokens
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    // Store refresh token in Redis
    await redisClient.setEx(`refreshToken:${user._id}`, 7 * 24 * 60 * 60, refreshToken);

    // Log registration
    await user.addLoginHistory(req.ip, req.get('User-Agent'), true);

    // Skip rate limiting for successful registration
    req.skipRateLimit = true;

    res.status(201).json({
      message: 'Registration successful. Please check your email to verify your account.',
      token,
      refreshToken,
      user: user.toJSON(),
      emailSent: true
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      message: 'Registration failed',
      code: 'REGISTRATION_FAILED',
      error: error.message
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
      errors: errors.array()
    });
  }

  try {
    const { emailOrUsername, password, rememberMe, mfaCode } = req.body;

    // Find user by email or username
    const user = await User.findOne({
      $or: [
        { email: emailOrUsername.toLowerCase() },
        { username: emailOrUsername }
      ]
    });

    if (!user) {
      return res.status(401).json({
        message: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
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

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      await user.incLoginAttempts();
      await user.addLoginHistory(req.ip, req.get('User-Agent'), false);

      return res.status(401).json({
        message: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Check MFA if enabled
    if (user.mfaEnabled) {
      if (!mfaCode) {
        return res.status(200).json({
          message: 'MFA code required',
          code: 'MFA_REQUIRED',
          requiresMFA: true
        });
      }

      const verified = speakeasy.totp.verify({
        secret: user.mfaSecret,
        encoding: 'base32',
        token: mfaCode,
        window: 2
      });

      if (!verified) {
        await user.incLoginAttempts();
        await user.addLoginHistory(req.ip, req.get('User-Agent'), false);

        return res.status(401).json({
          message: 'Invalid MFA code',
          code: 'INVALID_MFA_CODE'
        });
      }
    }

    // Reset login attempts on successful login
    await user.resetLoginAttempts();

    // Generate tokens
    const tokenExpiry = rememberMe ? '30d' : '15m';
    const token = generateToken(user._id, tokenExpiry);
    const refreshToken = generateRefreshToken(user._id);

    // Store refresh token in Redis
    const refreshExpiry = rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60;
    await redisClient.setEx(`refreshToken:${user._id}`, refreshExpiry, refreshToken);

    // Update last login and add to history
    user.lastLogin = new Date();
    await user.save();
    await user.addLoginHistory(req.ip, req.get('User-Agent'), true);

    // Skip rate limiting for successful login
    req.skipRateLimit = true;

    // Set secure cookie if remember me is enabled
    if (rememberMe) {
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      });
    }

    res.json({
      message: 'Login successful',
      token,
      refreshToken,
      user: user.toJSON(),
      expiresIn: tokenExpiry
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      message: 'Login failed',
      code: 'LOGIN_FAILED',
      error: error.message
    });
  }
});

// Refresh token
router.post('/refresh-token', validateRefreshToken, async (req, res) => {
  try {
    const { user, refreshToken: oldRefreshToken } = req;

    // Generate new tokens
    const newToken = generateToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    // Update refresh token in Redis
    await redisClient.setEx(`refreshToken:${user._id}`, 7 * 24 * 60 * 60, newRefreshToken);

    // Blacklist old refresh token
    await blacklistToken(oldRefreshToken, 7 * 24 * 60 * 60);

    res.json({
      message: 'Token refreshed successfully',
      token: newToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      message: 'Token refresh failed',
      code: 'TOKEN_REFRESH_FAILED',
      error: error.message
    });
  }
});

// Logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const { refreshToken } = req.body;

    // Blacklist access token
    if (token) {
      await blacklistToken(token, 15 * 60); // 15 minutes
    }

    // Remove refresh token from Redis and blacklist it
    if (refreshToken) {
      await redisClient.del(`refreshToken:${req.user._id}`);
      await blacklistToken(refreshToken, 7 * 24 * 60 * 60); // 7 days
    }

    // Clear cookie
    res.clearCookie('refreshToken');

    res.json({
      message: 'Logout successful',
      code: 'LOGOUT_SUCCESS'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      message: 'Logout failed',
      code: 'LOGOUT_FAILED',
      error: error.message
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
        code: 'TOKEN_REQUIRED'
      });
    }

    const user = await User.findOne({ emailVerificationToken: token });

    if (!user) {
      return res.status(400).json({
        message: 'Invalid or expired verification token',
        code: 'INVALID_TOKEN'
      });
    }

    // Mark email as verified
    user.isVerified = true;
    user.emailVerificationToken = null;
    await user.save();

    res.json({
      message: 'Email verified successfully',
      code: 'EMAIL_VERIFIED'
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      message: 'Email verification failed',
      code: 'VERIFICATION_FAILED',
      error: error.message
    });
  }
});

// Request password reset
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Valid email is required',
      code: 'VALIDATION_ERROR',
      errors: errors.array()
    });
  }

  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({
        message: 'If an account with that email exists, a password reset link has been sent.',
        code: 'RESET_EMAIL_SENT'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = resetToken;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    // Send reset email
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    await transporter.sendMail({
      from: process.env.FROM_EMAIL,
      to: email,
      subject: 'Password Reset - Listeners',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #8b5cf6;">Password Reset Request</h2>
          <p>Hi ${user.firstName || user.username},</p>
          <p>You requested a password reset for your Listeners account. Click the button below to reset your password:</p>
          <a href="${resetUrl}" style="display: inline-block; background: #8b5cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Reset Password</a>
          <p>Or copy and paste this link in your browser:</p>
          <p style="word-break: break-all; color: #666;">${resetUrl}</p>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this reset, please ignore this email and your password will remain unchanged.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">© 2024 Listeners. All rights reserved.</p>
        </div>
      `,
    });

    res.json({
      message: 'If an account with that email exists, a password reset link has been sent.',
      code: 'RESET_EMAIL_SENT'
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({
      message: 'Password reset request failed',
      code: 'RESET_REQUEST_FAILED',
      error: error.message
    });
  }
});

// Reset password
router.post('/reset-password', [
  body('token').notEmpty().withMessage('Reset token is required'),
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
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: errors.array()
    });
  }

  try {
    const { token, password } = req.body;

    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        message: 'Invalid or expired reset token',
        code: 'INVALID_RESET_TOKEN'
      });
    }

    // Update password
    user.password = password;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    user.loginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    // Invalidate all existing sessions
    await redisClient.del(`refreshToken:${user._id}`);

    res.json({
      message: 'Password reset successful',
      code: 'PASSWORD_RESET_SUCCESS'
    });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({
      message: 'Password reset failed',
      code: 'PASSWORD_RESET_FAILED',
      error: error.message
    });
  }
});

// Setup MFA
router.post('/setup-mfa', authenticateToken, async (req, res) => {
  try {
    const user = req.user;

    if (user.mfaEnabled) {
      return res.status(400).json({
        message: 'MFA is already enabled',
        code: 'MFA_ALREADY_ENABLED'
      });
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `Listeners (${user.email})`,
      issuer: 'Listeners',
      length: 32
    });

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    // Store secret temporarily (not saved until verified)
    await redisClient.setEx(`mfa_setup:${user._id}`, 10 * 60, secret.base32); // 10 minutes

    res.json({
      message: 'MFA setup initiated',
      secret: secret.base32,
      qrCode: qrCodeUrl,
      manualEntryKey: secret.base32
    });
  } catch (error) {
    console.error('MFA setup error:', error);
    res.status(500).json({
      message: 'MFA setup failed',
      code: 'MFA_SETUP_FAILED',
      error: error.message
    });
  }
});

// Verify and enable MFA
router.post('/verify-mfa', authenticateToken, [
  body('code').isLength({ min: 6, max: 6 }).isNumeric()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Valid 6-digit code is required',
      code: 'VALIDATION_ERROR',
      errors: errors.array()
    });
  }

  try {
    const { code } = req.body;
    const user = req.user;

    // Get temporary secret
    const secret = await redisClient.get(`mfa_setup:${user._id}`);
    if (!secret) {
      return res.status(400).json({
        message: 'MFA setup session expired. Please start over.',
        code: 'MFA_SETUP_EXPIRED'
      });
    }

    // Verify code
    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: code,
      window: 2
    });

    if (!verified) {
      return res.status(400).json({
        message: 'Invalid MFA code',
        code: 'INVALID_MFA_CODE'
      });
    }

    // Enable MFA
    user.mfaEnabled = true;
    user.mfaSecret = secret;
    await user.save();

    // Clean up temporary secret
    await redisClient.del(`mfa_setup:${user._id}`);

    res.json({
      message: 'MFA enabled successfully',
      code: 'MFA_ENABLED'
    });
  } catch (error) {
    console.error('MFA verification error:', error);
    res.status(500).json({
      message: 'MFA verification failed',
      code: 'MFA_VERIFICATION_FAILED',
      error: error.message
    });
  }
});

// Disable MFA
router.post('/disable-mfa', authenticateToken, [
  body('password').notEmpty().withMessage('Password is required'),
  body('code').isLength({ min: 6, max: 6 }).isNumeric().withMessage('Valid 6-digit code is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: errors.array()
    });
  }

  try {
    const { password, code } = req.body;
    const user = req.user;

    if (!user.mfaEnabled) {
      return res.status(400).json({
        message: 'MFA is not enabled',
        code: 'MFA_NOT_ENABLED'
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        message: 'Invalid password',
        code: 'INVALID_PASSWORD'
      });
    }

    // Verify MFA code
    const verified = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: code,
      window: 2
    });

    if (!verified) {
      return res.status(400).json({
        message: 'Invalid MFA code',
        code: 'INVALID_MFA_CODE'
      });
    }

    // Disable MFA
    user.mfaEnabled = false;
    user.mfaSecret = null;
    await user.save();

    res.json({
      message: 'MFA disabled successfully',
      code: 'MFA_DISABLED'
    });
  } catch (error) {
    console.error('MFA disable error:', error);
    res.status(500).json({
      message: 'MFA disable failed',
      code: 'MFA_DISABLE_FAILED',
      error: error.message
    });
  }
});

// Google OAuth routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  async (req, res) => {
    try {
      const token = generateToken(req.user._id);
      const refreshToken = generateRefreshToken(req.user._id);

      await redisClient.setEx(`refreshToken:${req.user._id}`, 7 * 24 * 60 * 60, refreshToken);
      await req.user.addLoginHistory(req.ip, req.get('User-Agent'), true);

      res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}&refreshToken=${refreshToken}`);
    } catch (error) {
      console.error('Google OAuth callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
    }
  }
);

export default router;