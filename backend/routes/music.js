const express = require('express');
const multer = require('multer');
const path = require('path');
const { body, query, validationResult } = require('express-validator');
const Song = require('../models/Song');
const User = require('../models/User');
const { authenticateToken, optionalAuth, requirePremium } = require('../middleware/auth');

const router = express.Router();

// Configure multer for audio file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/audio/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/mp4'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only MP3, WAV, FLAC, and M4A files are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Get all songs with pagination and filtering
router.get('/', optionalAuth, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('genre').optional().isString().withMessage('Genre must be a string'),
  query('search').optional().isString().withMessage('Search must be a string')
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
    const { genre, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    // Build query
    let query = { isPublic: true };
    
    if (genre) {
      query.genre = new RegExp(genre, 'i');
    }
    
    if (search) {
      query.$text = { $search: search };
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const songs = await Song.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('uploadedBy', 'username avatar')
      .select('-__v');

    const total = await Song.countDocuments(query);

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
    console.error('Get songs error:', error);
    res.status(500).json({ message: 'Failed to fetch songs' });
  }
});

// Get trending songs
router.get('/trending', optionalAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    
    const songs = await Song.find({ isPublic: true })
      .sort({ playCount: -1, createdAt: -1 })
      .limit(limit)
      .populate('uploadedBy', 'username avatar')
      .select('-__v');

    res.json({ songs });
  } catch (error) {
    console.error('Get trending songs error:', error);
    res.status(500).json({ message: 'Failed to fetch trending songs' });
  }
});

// Get recently added songs
router.get('/recent', optionalAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    
    const songs = await Song.find({ isPublic: true })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('uploadedBy', 'username avatar')
      .select('-__v');

    res.json({ songs });
  } catch (error) {
    console.error('Get recent songs error:', error);
    res.status(500).json({ message: 'Failed to fetch recent songs' });
  }
});

// Get single song
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const song = await Song.findById(req.params.id)
      .populate('uploadedBy', 'username avatar')
      .select('-__v');

    if (!song) {
      return res.status(404).json({ message: 'Song not found' });
    }

    // Check if song is public or user owns it
    if (!song.isPublic && (!req.user || song.uploadedBy._id.toString() !== req.user._id.toString())) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ song });
  } catch (error) {
    console.error('Get song error:', error);
    res.status(500).json({ message: 'Failed to fetch song' });
  }
});

// Upload new song
router.post('/upload', authenticateToken, upload.single('audio'), [
  body('title').notEmpty().trim().withMessage('Title is required'),
  body('artist').notEmpty().trim().withMessage('Artist is required'),
  body('album').optional().trim(),
  body('genre').optional().trim(),
  body('duration').isInt({ min: 1 }).withMessage('Duration must be a positive integer'),
  body('isPublic').optional().isBoolean().withMessage('isPublic must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Audio file is required' });
    }

    const { title, artist, album, genre, duration, isPublic = true, tags, lyrics } = req.body;

    const song = new Song({
      title,
      artist,
      album,
      genre,
      duration: parseInt(duration),
      fileUrl: `/uploads/audio/${req.file.filename}`,
      isPublic: isPublic === 'true',
      uploadedBy: req.user._id,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      lyrics
    });

    await song.save();
    await song.populate('uploadedBy', 'username avatar');

    res.status(201).json({
      message: 'Song uploaded successfully',
      song
    });
  } catch (error) {
    console.error('Upload song error:', error);
    res.status(500).json({ message: 'Failed to upload song' });
  }
});

// Update song
router.put('/:id', authenticateToken, [
  body('title').optional().notEmpty().trim().withMessage('Title cannot be empty'),
  body('artist').optional().notEmpty().trim().withMessage('Artist cannot be empty'),
  body('album').optional().trim(),
  body('genre').optional().trim(),
  body('isPublic').optional().isBoolean().withMessage('isPublic must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const song = await Song.findById(req.params.id);
    
    if (!song) {
      return res.status(404).json({ message: 'Song not found' });
    }

    // Check ownership
    if (song.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { title, artist, album, genre, isPublic, tags, lyrics } = req.body;

    // Update fields
    if (title !== undefined) song.title = title;
    if (artist !== undefined) song.artist = artist;
    if (album !== undefined) song.album = album;
    if (genre !== undefined) song.genre = genre;
    if (isPublic !== undefined) song.isPublic = isPublic;
    if (tags !== undefined) song.tags = tags.split(',').map(tag => tag.trim());
    if (lyrics !== undefined) song.lyrics = lyrics;

    await song.save();
    await song.populate('uploadedBy', 'username avatar');

    res.json({
      message: 'Song updated successfully',
      song
    });
  } catch (error) {
    console.error('Update song error:', error);
    res.status(500).json({ message: 'Failed to update song' });
  }
});

// Delete song
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    
    if (!song) {
      return res.status(404).json({ message: 'Song not found' });
    }

    // Check ownership
    if (song.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await Song.findByIdAndDelete(req.params.id);

    res.json({ message: 'Song deleted successfully' });
  } catch (error) {
    console.error('Delete song error:', error);
    res.status(500).json({ message: 'Failed to delete song' });
  }
});

// Like/Unlike song
router.post('/:id/like', authenticateToken, async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    
    if (!song) {
      return res.status(404).json({ message: 'Song not found' });
    }

    const user = await User.findById(req.user._id);
    const isLiked = user.likedSongs.includes(song._id);

    if (isLiked) {
      // Unlike
      user.likedSongs = user.likedSongs.filter(id => id.toString() !== song._id.toString());
      song.likes = Math.max(0, song.likes - 1);
    } else {
      // Like
      user.likedSongs.push(song._id);
      song.likes += 1;
    }

    await Promise.all([user.save(), song.save()]);

    res.json({
      message: isLiked ? 'Song unliked' : 'Song liked',
      isLiked: !isLiked,
      likes: song.likes
    });
  } catch (error) {
    console.error('Like song error:', error);
    res.status(500).json({ message: 'Failed to like/unlike song' });
  }
});

// Track play count
router.post('/:id/play', optionalAuth, async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    
    if (!song) {
      return res.status(404).json({ message: 'Song not found' });
    }

    // Increment play count
    await song.incrementPlayCount();

    // Add to user's recently played if authenticated
    if (req.user) {
      const user = await User.findById(req.user._id);
      
      // Remove if already in recently played
      user.recentlyPlayed = user.recentlyPlayed.filter(
        item => item.song.toString() !== song._id.toString()
      );
      
      // Add to beginning
      user.recentlyPlayed.unshift({
        song: song._id,
        playedAt: new Date()
      });
      
      // Keep only last 50 played songs
      user.recentlyPlayed = user.recentlyPlayed.slice(0, 50);
      
      await user.save();
    }

    res.json({
      message: 'Play tracked',
      playCount: song.playCount
    });
  } catch (error) {
    console.error('Track play error:', error);
    res.status(500).json({ message: 'Failed to track play' });
  }
});

module.exports = router;