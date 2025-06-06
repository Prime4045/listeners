const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Playlist = require('../models/Playlist');
const Song = require('../models/Song');
const User = require('../models/User');
const { authenticateToken, optionalAuth, requireOwnership } = require('../middleware/auth');

const router = express.Router();

// Get all public playlists
router.get('/', optionalAuth, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
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
    const { search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    let query = { isPublic: true };
    
    if (search) {
      query.$text = { $search: search };
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const playlists = await Playlist.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('owner', 'username avatar')
      .populate('songs.song', 'title artist duration coverImage')
      .select('-__v');

    const total = await Playlist.countDocuments(query);

    res.json({
      playlists,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get playlists error:', error);
    res.status(500).json({ message: 'Failed to fetch playlists' });
  }
});

// Get user's playlists
router.get('/my-playlists', authenticateToken, [
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

    const playlists = await Playlist.find({ owner: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('songs.song', 'title artist duration coverImage')
      .select('-__v');

    const total = await Playlist.countDocuments({ owner: req.user._id });

    res.json({
      playlists,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get my playlists error:', error);
    res.status(500).json({ message: 'Failed to fetch your playlists' });
  }
});

// Get single playlist
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id)
      .populate('owner', 'username avatar')
      .populate('collaborators.user', 'username avatar')
      .populate('songs.song', 'title artist duration coverImage fileUrl uploadedBy')
      .populate('songs.addedBy', 'username avatar')
      .select('-__v');

    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found' });
    }

    // Check if user can access this playlist
    const canAccess = playlist.isPublic || 
                     (req.user && (
                       playlist.owner._id.toString() === req.user._id.toString() ||
                       playlist.collaborators.some(collab => 
                         collab.user._id.toString() === req.user._id.toString()
                       )
                     ));

    if (!canAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ playlist });
  } catch (error) {
    console.error('Get playlist error:', error);
    res.status(500).json({ message: 'Failed to fetch playlist' });
  }
});

// Create new playlist
router.post('/', authenticateToken, [
  body('name').notEmpty().trim().isLength({ max: 100 }).withMessage('Name is required and must be less than 100 characters'),
  body('description').optional().trim().isLength({ max: 500 }).withMessage('Description must be less than 500 characters'),
  body('isPublic').optional().isBoolean().withMessage('isPublic must be a boolean'),
  body('isCollaborative').optional().isBoolean().withMessage('isCollaborative must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, description, isPublic = false, isCollaborative = false, tags } = req.body;

    const playlist = new Playlist({
      name,
      description,
      owner: req.user._id,
      isPublic,
      isCollaborative,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : []
    });

    await playlist.save();
    await playlist.populate('owner', 'username avatar');

    // Add to user's playlists
    const user = await User.findById(req.user._id);
    user.playlists.push(playlist._id);
    await user.save();

    res.status(201).json({
      message: 'Playlist created successfully',
      playlist
    });
  } catch (error) {
    console.error('Create playlist error:', error);
    res.status(500).json({ message: 'Failed to create playlist' });
  }
});

// Update playlist
router.put('/:id', authenticateToken, [
  body('name').optional().notEmpty().trim().isLength({ max: 100 }).withMessage('Name must be less than 100 characters'),
  body('description').optional().trim().isLength({ max: 500 }).withMessage('Description must be less than 500 characters'),
  body('isPublic').optional().isBoolean().withMessage('isPublic must be a boolean'),
  body('isCollaborative').optional().isBoolean().withMessage('isCollaborative must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const playlist = await Playlist.findById(req.params.id);
    
    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found' });
    }

    // Check ownership or admin collaboration
    const canEdit = playlist.owner.toString() === req.user._id.toString() ||
                   playlist.collaborators.some(collab => 
                     collab.user.toString() === req.user._id.toString() && 
                     ['edit', 'admin'].includes(collab.permissions)
                   );

    if (!canEdit) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { name, description, isPublic, isCollaborative, tags } = req.body;

    if (name !== undefined) playlist.name = name;
    if (description !== undefined) playlist.description = description;
    if (isPublic !== undefined) playlist.isPublic = isPublic;
    if (isCollaborative !== undefined) playlist.isCollaborative = isCollaborative;
    if (tags !== undefined) playlist.tags = tags.split(',').map(tag => tag.trim());

    await playlist.save();
    await playlist.populate('owner', 'username avatar');

    res.json({
      message: 'Playlist updated successfully',
      playlist
    });
  } catch (error) {
    console.error('Update playlist error:', error);
    res.status(500).json({ message: 'Failed to update playlist' });
  }
});

// Delete playlist
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    
    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found' });
    }

    // Check ownership
    if (playlist.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await Playlist.findByIdAndDelete(req.params.id);

    // Remove from user's playlists
    const user = await User.findById(req.user._id);
    user.playlists = user.playlists.filter(id => id.toString() !== req.params.id);
    await user.save();

    res.json({ message: 'Playlist deleted successfully' });
  } catch (error) {
    console.error('Delete playlist error:', error);
    res.status(500).json({ message: 'Failed to delete playlist' });
  }
});

// Add song to playlist
router.post('/:id/songs', authenticateToken, [
  body('songId').notEmpty().isMongoId().withMessage('Valid song ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { songId } = req.body;
    
    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found' });
    }

    const song = await Song.findById(songId);
    if (!song) {
      return res.status(404).json({ message: 'Song not found' });
    }

    // Check permissions
    const canAdd = playlist.owner.toString() === req.user._id.toString() ||
                  (playlist.isCollaborative && 
                   playlist.collaborators.some(collab => 
                     collab.user.toString() === req.user._id.toString()
                   ));

    if (!canAdd) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Check if song already exists
    const existingSong = playlist.songs.find(s => s.song.toString() === songId);
    if (existingSong) {
      return res.status(409).json({ message: 'Song already exists in playlist' });
    }

    playlist.songs.push({
      song: songId,
      addedBy: req.user._id
    });

    await playlist.save();
    await playlist.populate('songs.song', 'title artist duration coverImage');
    await playlist.populate('songs.addedBy', 'username avatar');

    res.json({
      message: 'Song added to playlist',
      playlist
    });
  } catch (error) {
    console.error('Add song to playlist error:', error);
    res.status(500).json({ message: 'Failed to add song to playlist' });
  }
});

// Remove song from playlist
router.delete('/:id/songs/:songId', authenticateToken, async (req, res) => {
  try {
    const { songId } = req.params;
    
    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found' });
    }

    // Check permissions
    const canRemove = playlist.owner.toString() === req.user._id.toString() ||
                     (playlist.isCollaborative && 
                      playlist.collaborators.some(collab => 
                        collab.user.toString() === req.user._id.toString()
                      ));

    if (!canRemove) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const songIndex = playlist.songs.findIndex(s => s.song.toString() === songId);
    if (songIndex === -1) {
      return res.status(404).json({ message: 'Song not found in playlist' });
    }

    playlist.songs.splice(songIndex, 1);
    await playlist.save();

    res.json({ message: 'Song removed from playlist' });
  } catch (error) {
    console.error('Remove song from playlist error:', error);
    res.status(500).json({ message: 'Failed to remove song from playlist' });
  }
});

// Follow/Unfollow playlist
router.post('/:id/follow', authenticateToken, async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    
    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found' });
    }

    if (!playlist.isPublic) {
      return res.status(403).json({ message: 'Cannot follow private playlist' });
    }

    const isFollowing = playlist.followers.includes(req.user._id);

    if (isFollowing) {
      // Unfollow
      playlist.followers = playlist.followers.filter(
        id => id.toString() !== req.user._id.toString()
      );
    } else {
      // Follow
      playlist.followers.push(req.user._id);
    }

    await playlist.save();

    res.json({
      message: isFollowing ? 'Playlist unfollowed' : 'Playlist followed',
      isFollowing: !isFollowing,
      followers: playlist.followers.length
    });
  } catch (error) {
    console.error('Follow playlist error:', error);
    res.status(500).json({ message: 'Failed to follow/unfollow playlist' });
  }
});

module.exports = router;