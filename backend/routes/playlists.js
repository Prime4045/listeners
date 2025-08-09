import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken, requireOwnership } from '../middleware/auth.js';
import Playlist from '../models/Playlist.js';
import Song from '../models/Song.js';
import User from '../models/User.js';

const router = express.Router();

// Get user's playlists
router.get('/', authenticateToken, async (req, res) => {
  try {
    const playlists = await Playlist.find({ 
      $or: [
        { owner: req.user._id },
        { 'collaborators.user': req.user._id }
      ]
    })
      .populate('songs.song')
      .populate('owner', 'username avatar')
      .sort({ createdAt: -1 });

    res.json({
      playlists,
      total: playlists.length
    });
  } catch (error) {
    console.error('Get playlists error:', error);
    res.status(500).json({ 
      message: 'Failed to fetch playlists', 
      error: error.message 
    });
  }
});

// Get single playlist
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id)
      .populate('songs.song')
      .populate('owner', 'username avatar')
      .populate('collaborators.user', 'username avatar');

    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found' });
    }

    // Check if user has access to this playlist
    const hasAccess = playlist.isPublic || 
                     playlist.owner._id.toString() === req.user._id.toString() ||
                     playlist.collaborators.some(collab => collab.user._id.toString() === req.user._id.toString());

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(playlist);
  } catch (error) {
    console.error('Get playlist error:', error);
    res.status(500).json({ 
      message: 'Failed to fetch playlist', 
      error: error.message 
    });
  }
});

// Create new playlist
router.post(
  '/',
  authenticateToken,
  [
    body('name').trim().notEmpty().isLength({ max: 100 }).withMessage('Name is required and must be less than 100 characters'),
    body('description').optional().trim().isLength({ max: 500 }).withMessage('Description must be less than 500 characters'),
    body('isPublic').optional().isBoolean().withMessage('isPublic must be a boolean'),
    body('isCollaborative').optional().isBoolean().withMessage('isCollaborative must be a boolean'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array() 
      });
    }

    try {
      const { name, description, isPublic = false, isCollaborative = false } = req.body;
      
      const playlist = new Playlist({
        name,
        description,
        isPublic,
        isCollaborative,
        owner: req.user._id,
      });

      await playlist.save();

      // Add playlist to user's playlists array
      await User.findByIdAndUpdate(req.user._id, { 
        $push: { playlists: playlist._id } 
      });

      // Populate the playlist before sending response
      await playlist.populate('owner', 'username avatar');

      res.status(201).json({
        message: 'Playlist created successfully',
        playlist
      });
    } catch (error) {
      console.error('Create playlist error:', error);
      res.status(500).json({ 
        message: 'Failed to create playlist', 
        error: error.message 
      });
    }
  }
);

// Update playlist
router.put(
  '/:id',
  authenticateToken,
  [
    body('name').optional().trim().notEmpty().isLength({ max: 100 }),
    body('description').optional().trim().isLength({ max: 500 }),
    body('isPublic').optional().isBoolean(),
    body('isCollaborative').optional().isBoolean(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array() 
      });
    }

    try {
      const playlist = await Playlist.findById(req.params.id);
      
      if (!playlist) {
        return res.status(404).json({ message: 'Playlist not found' });
      }

      // Check ownership or admin collaboration
      const isOwner = playlist.owner.toString() === req.user._id.toString();
      const isAdmin = playlist.collaborators.some(
        collab => collab.user.toString() === req.user._id.toString() && collab.permissions === 'admin'
      );

      if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Update playlist
      Object.keys(req.body).forEach(key => {
        if (req.body[key] !== undefined) {
          playlist[key] = req.body[key];
        }
      });

      await playlist.save();
      await playlist.populate('owner', 'username avatar');

      res.json({
        message: 'Playlist updated successfully',
        playlist
      });
    } catch (error) {
      console.error('Update playlist error:', error);
      res.status(500).json({ 
        message: 'Failed to update playlist', 
        error: error.message 
      });
    }
  }
);

// Delete playlist
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    
    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found' });
    }

    // Only owner can delete playlist
    if (playlist.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only playlist owner can delete' });
    }

    await Playlist.findByIdAndDelete(req.params.id);

    // Remove playlist from user's playlists array
    await User.findByIdAndUpdate(req.user._id, { 
      $pull: { playlists: req.params.id } 
    });

    res.json({ message: 'Playlist deleted successfully' });
  } catch (error) {
    console.error('Delete playlist error:', error);
    res.status(500).json({ 
      message: 'Failed to delete playlist', 
      error: error.message 
    });
  }
});

// Add song to playlist
router.post(
  '/:id/songs',
  authenticateToken,
  [
    body('spotifyId').notEmpty().withMessage('Spotify ID is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array() 
      });
    }

    try {
      const { spotifyId } = req.body;
      const playlist = await Playlist.findById(req.params.id);
      
      if (!playlist) {
        return res.status(404).json({ message: 'Playlist not found' });
      }

      // Check permissions
      const isOwner = playlist.owner.toString() === req.user._id.toString();
      const canEdit = playlist.collaborators.some(
        collab => collab.user.toString() === req.user._id.toString() && 
                 ['edit', 'admin'].includes(collab.permissions)
      );

      if (!isOwner && !canEdit && !playlist.isCollaborative) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Find or create song
      let song = await Song.findOne({ spotifyId });
      if (!song) {
        return res.status(404).json({ 
          message: 'Song not found. Please play the song first to add it to database.' 
        });
      }

      // Check if song already exists in playlist
      const existingSong = playlist.songs.find(
        s => s.song.toString() === song._id.toString()
      );

      if (existingSong) {
        return res.status(409).json({ message: 'Song already exists in playlist' });
      }

      // Add song to playlist
      await playlist.addSong(song._id, req.user._id);
      await playlist.populate('songs.song');
      await playlist.populate('owner', 'username avatar');

      res.json({
        message: 'Song added to playlist successfully',
        playlist
      });
    } catch (error) {
      console.error('Add song to playlist error:', error);
      res.status(500).json({ 
        message: 'Failed to add song to playlist', 
        error: error.message 
      });
    }
  }
);

// Remove song from playlist
router.delete('/:id/songs/:songId', authenticateToken, async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    
    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found' });
    }

    // Check permissions
    const isOwner = playlist.owner.toString() === req.user._id.toString();
    const canEdit = playlist.collaborators.some(
      collab => collab.user.toString() === req.user._id.toString() && 
               ['edit', 'admin'].includes(collab.permissions)
    );

    if (!isOwner && !canEdit && !playlist.isCollaborative) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await playlist.removeSong(req.params.songId);
    await playlist.populate('songs.song');
    await playlist.populate('owner', 'username avatar');

    res.json({
      message: 'Song removed from playlist successfully',
      playlist
    });
  } catch (error) {
    console.error('Remove song from playlist error:', error);
    res.status(500).json({ 
      message: 'Failed to remove song from playlist', 
      error: error.message 
    });
  }
});

// Reorder songs in playlist
router.put('/:id/songs/reorder', authenticateToken, async (req, res) => {
  try {
    const { songId, newPosition } = req.body;
    const playlist = await Playlist.findById(req.params.id);
    
    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found' });
    }

    // Check permissions
    const isOwner = playlist.owner.toString() === req.user._id.toString();
    const canEdit = playlist.collaborators.some(
      collab => collab.user.toString() === req.user._id.toString() && 
               ['edit', 'admin'].includes(collab.permissions)
    );

    if (!isOwner && !canEdit && !playlist.isCollaborative) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await playlist.reorderSongs(songId, newPosition);
    await playlist.populate('songs.song');
    await playlist.populate('owner', 'username avatar');

    res.json({
      message: 'Playlist reordered successfully',
      playlist
    });
  } catch (error) {
    console.error('Reorder playlist error:', error);
    res.status(500).json({ 
      message: 'Failed to reorder playlist', 
      error: error.message 
    });
  }
});

// Get public playlists
router.get('/public/all', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const playlists = await Playlist.find({ isPublic: true, isActive: true })
      .populate('owner', 'username avatar')
      .sort({ playCount: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Playlist.countDocuments({ isPublic: true, isActive: true });

    res.json({
      playlists,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        total,
        hasNext: skip + playlists.length < total,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Get public playlists error:', error);
    res.status(500).json({ 
      message: 'Failed to fetch public playlists', 
      error: error.message 
    });
  }
});

export default router;