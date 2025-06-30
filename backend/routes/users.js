import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('likedSongs')
      .populate('playlists')
      .populate('followedArtists')
      .select('-password -mfaSecret -emailVerificationToken -passwordResetToken');

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    res.json({
      user,
      stats: {
        totalPlaylists: user.playlists.length,
        totalLikedSongs: user.likedSongs.length,
        totalFollowedArtists: user.followedArtists.length,
        memberSince: user.createdAt,
        lastLogin: user.lastLogin,
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      message: 'Failed to fetch profile',
      code: 'FETCH_PROFILE_FAILED',
      error: error.message,
    });
  }
});

// Update user profile
router.put(
  '/profile',
  authenticateToken,
  [
    body('username')
      .optional()
      .trim()
      .isLength({ min: 3, max: 20 })
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username must be 3-20 characters and contain only letters, numbers, and underscores'),
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
    body('preferences.theme')
      .optional()
      .isIn(['dark', 'light'])
      .withMessage('Theme must be either dark or light'),
    body('preferences.autoplay')
      .optional()
      .isBoolean()
      .withMessage('Autoplay must be a boolean'),
    body('preferences.quality')
      .optional()
      .isIn(['low', 'medium', 'high'])
      .withMessage('Quality must be low, medium, or high'),
    body('preferences.notifications.email')
      .optional()
      .isBoolean()
      .withMessage('Email notifications must be a boolean'),
    body('preferences.notifications.push')
      .optional()
      .isBoolean()
      .withMessage('Push notifications must be a boolean'),
    body('preferences.volumeSync')
      .optional()
      .isBoolean()
      .withMessage('Volume sync must be a boolean'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: errors.array(),
      });
    }

    try {
      const userId = req.user._id;
      const updates = { ...req.body };

      // Remove restricted fields
      delete updates.email;
      delete updates.password;
      delete updates.phoneNumber;
      delete updates.googleId;
      delete updates.isVerified;
      delete updates.subscription;
      delete updates.mfaEnabled;
      delete updates.mfaSecret;
      delete updates.avatar; // Remove avatar from updates

      // Check if username is being changed and if it's available
      if (updates.username) {
        const existingUser = await User.findOne({
          username: updates.username,
          _id: { $ne: userId },
        });

        if (existingUser) {
          return res.status(409).json({
            message: 'Username already taken',
            code: 'USERNAME_TAKEN',
            field: 'username',
          });
        }
      }

      // Update user
      const user = await User.findByIdAndUpdate(
        userId,
        { $set: updates },
        { new: true, runValidators: true }
      ).select('-password -mfaSecret -emailVerificationToken -passwordResetToken');

      if (!user) {
        return res.status(404).json({
          message: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      res.json({
        message: 'Profile updated successfully',
        user: user.toJSON(),
      });
    } catch (error) {
      console.error('Update profile error:', error);

      if (error.code === 11000) {
        const field = Object.keys(error.keyValue)[0];
        return res.status(409).json({
          message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`,
          code: 'DUPLICATE_ENTRY',
          field,
        });
      }

      res.status(500).json({
        message: 'Failed to update profile',
        code: 'UPDATE_PROFILE_FAILED',
        error: error.message,
      });
    }
  }
);

// Change password
router.put(
  '/change-password',
  authenticateToken,
  [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('New password must be at least 8 characters with 1 uppercase, 1 lowercase, 1 number, and 1 special character'),
    body('confirmPassword')
      .custom((value, { req }) => {
        if (value !== req.body.newPassword) {
          throw new Error('Passwords do not match');
        }
        return true;
      }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: errors.array(),
      });
    }

    try {
      const { currentPassword, newPassword } = req.body;
      const user = await User.findById(req.user._id);

      if (!user) {
        return res.status(404).json({
          message: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      // Verify current password
      const isCurrentPasswordValid = await user.comparePassword(currentPassword);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          message: 'Current password is incorrect',
          code: 'INVALID_CURRENT_PASSWORD',
        });
      }

      // Update password
      user.password = newPassword;
      await user.save();

      res.json({
        message: 'Password changed successfully',
        code: 'PASSWORD_CHANGED',
      });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        message: 'Failed to change password',
        code: 'CHANGE_PASSWORD_FAILED',
        error: error.message,
      });
    }
  }
);

// Change email
router.put(
  '/change-email',
  authenticateToken,
  [
    body('newEmail')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
    body('password')
      .notEmpty()
      .withMessage('Password is required to change email'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: errors.array(),
      });
    }

    try {
      const { newEmail, password } = req.body;
      const user = await User.findById(req.user._id);

      if (!user) {
        return res.status(404).json({
          message: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      // Verify password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        return res.status(400).json({
          message: 'Password is incorrect',
          code: 'INVALID_PASSWORD',
        });
      }

      // Check if email is already taken
      const existingUser = await User.findOne({
        email: newEmail.toLowerCase(),
        _id: { $ne: user._id },
      });

      if (existingUser) {
        return res.status(409).json({
          message: 'Email already registered',
          code: 'EMAIL_TAKEN',
        });
      }

      // Update email and mark as unverified
      user.email = newEmail.toLowerCase();
      user.isVerified = false;
      user.emailVerificationToken = crypto.randomBytes(32).toString('hex');
      await user.save();

      res.json({
        message: 'Email changed successfully. Please verify your new email address.',
        code: 'EMAIL_CHANGED',
        emailSent: false,
      });
    } catch (error) {
      console.error('Change email error:', error);
      res.status(500).json({
        message: 'Failed to change email',
        code: 'CHANGE_EMAIL_FAILED',
        error: error.message,
      });
    }
  }
);

// Get user dashboard data
router.get('/dashboard', authenticateToken, async (req, res) => {
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

    // Get user statistics
    const stats = {
      totalPlaylists: user.playlists.length,
      totalLikedSongs: user.likedSongs.length,
      totalFollowedArtists: user.followedArtists.length,
      recentlyPlayedCount: user.recentlyPlayed.length,
      memberSince: user.createdAt,
      lastLogin: user.lastLogin,
      subscriptionType: user.subscription.type,
      subscriptionExpiry: user.subscription.expiresAt,
    };

    res.json({
      user: user.toJSON(),
      stats,
      recentActivity: user.recentlyPlayed.slice(0, 10), // Last 10 played songs
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({
      message: 'Failed to fetch dashboard data',
      code: 'FETCH_DASHBOARD_FAILED',
      error: error.message,
    });
  }
});

// Delete user account
router.delete('/account', authenticateToken, async (req, res) => {
  try {
    const { password } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(400).json({
        message: 'Password is incorrect',
        code: 'INVALID_PASSWORD',
      });
    }

    // Soft delete - mark as inactive instead of actually deleting
    user.isActive = false;
    user.email = `deleted_${Date.now()}_${user.email}`;
    user.username = `deleted_${Date.now()}_${user.username}`;
    await user.save();

    res.json({
      message: 'Account deleted successfully',
      code: 'ACCOUNT_DELETED',
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      message: 'Failed to delete account',
      code: 'DELETE_ACCOUNT_FAILED',
      error: error.message,
    });
  }
});

export default router;