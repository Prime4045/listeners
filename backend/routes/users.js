const express = require('express');
const { query, validationResult } = require('express-validator');
const User = require('../models/User');
const Song = require('../models/Song');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Get user's recently played songs
router.get('/recently-played', authenticateToken, [
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const limit = parseInt(req.query.limit) || 20;
    
    const user = await User.findById(req.user._id)
      .populate({
        path: 'recentlyPlayed.song',
        populate: {
          path: 'uploadedBy',
          select: 'username avatar'
        }
      })
      .select('recentlyPlayed');

    const recentlyPlayed = user.recentlyPlayed
      .slice(0, limit)
      .map(item => ({
        song: item.song,
        playedAt: item.playedAt
      }));

    res.json({ recentlyPlayed });
  } catch (error) {
    console.error('Get recently played error:', error);
    res.status(500).json({ message: 'Failed to fetch recently played songs' });
  }
});

// Get user's liked songs
router.get('/liked-songs', authenticateToken, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const user = await User.findById(req.user._id)
      .populate({
        path: 'likedSongs',
        populate: {
          path: 'uploadedBy',
          select: 'username avatar'
        },
        options: {
          skip,
          limit,
          sort: { createdAt: -1 }
        }
      })
      .select('likedSongs');

    const total = user.likedSongs.length;

    res.json({
      likedSongs: user.likedSongs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get liked songs error:', error);
    res.status(500).json({ message: 'Failed to fetch liked songs' });
  }
});

// Get user's uploaded songs
router.get('/my-songs', authenticateToken, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const songs = await Song.find({ uploadedBy: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('uploadedBy', 'username avatar')
      .select('-__v');

    const total = await Song.countDocuments({ uploadedBy: req.user._id });

    res.json({
      songs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get my songs error:', error);
    res.status(500).json({ message: 'Failed to fetch your songs' });
  }
});

// Get user profile by ID or username
router.get('/:identifier', optionalAuth, async (req, res) => {
  try {
    const { identifier } = req.params;
    
    // Check if identifier is ObjectId or username
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(identifier);
    const query = isObjectId ? { _id: identifier } : { username: identifier };
    
    const user = await User.findOne(query)
      .populate('playlists', 'name description coverImage songCount isPublic')
      .select('-password -email -googleId -recentlyPlayed');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user's public songs
    const songs = await Song.find({ 
      uploadedBy: user._id, 
      isPublic: true 
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('title artist duration coverImage playCount likes');

    // Filter public playlists
    const publicPlaylists = user.playlists.filter(playlist => playlist.isPublic);

    res.json({
      user: {
        id: user._id,
        username: user.username,
        avatar: user.avatar,
        createdAt: user.createdAt,
        publicPlaylists,
        recentSongs: songs,
        stats: {
          totalSongs: songs.length,
          totalPlaylists: publicPlaylists.length
        }
      }
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ message: 'Failed to fetch user profile' });
  }
});

// Follow/Unfollow user
router.post('/:id/follow', authenticateToken, async (req, res) => {
  try {
    const targetUserId = req.params.id;
    
    if (targetUserId === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot follow yourself' });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const currentUser = await User.findById(req.user._id);
    const isFollowing = currentUser.followedArtists.includes(targetUserId);

    if (isFollowing) {
      // Unfollow
      currentUser.followedArtists = currentUser.followedArtists.filter(
        id => id.toString() !== targetUserId
      );
    } else {
      // Follow
      currentUser.followedArtists.push(targetUserId);
    }

    await currentUser.save();

    res.json({
      message: isFollowing ? 'User unfollowed' : 'User followed',
      isFollowing: !isFollowing
    });
  } catch (error) {
    console.error('Follow user error:', error);
    res.status(500).json({ message: 'Failed to follow/unfollow user' });
  }
});

// Get user's followers
router.get('/:id/followers', optionalAuth, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const followers = await User.find({ 
      followedArtists: req.params.id 
    })
      .select('username avatar createdAt')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments({ 
      followedArtists: req.params.id 
    });

    res.json({
      followers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get followers error:', error);
    res.status(500).json({ message: 'Failed to fetch followers' });
  }
});

// Get user's following
router.get('/:id/following', optionalAuth, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const user = await User.findById(req.params.id)
      .populate({
        path: 'followedArtists',
        select: 'username avatar createdAt',
        options: {
          skip,
          limit,
          sort: { createdAt: -1 }
        }
      })
      .select('followedArtists');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const total = user.followedArtists.length;

    res.json({
      following: user.followedArtists,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get following error:', error);
    res.status(500).json({ message: 'Failed to fetch following' });
  }
});

module.exports = router;