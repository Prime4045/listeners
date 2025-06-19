import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import Song from '../models/Song.js';
import PlayHistory from '../models/PlayHistory.js';
import cacheService from '../services/cacheService.js';

const router = express.Router();

// Get all songs with pagination and filtering
router.get('/', optionalAuth, async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            genre,
            artist,
            search,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const query = { isActive: true };

        // Apply filters
        if (genre) query.genre = { $regex: genre, $options: 'i' };
        if (artist) query.artist = { $regex: artist, $options: 'i' };
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { artist: { $regex: search, $options: 'i' } },
                { album: { $regex: search, $options: 'i' } },
                { genre: { $regex: search, $options: 'i' } }
            ];
        }

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        const songs = await Song.find(query)
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit))
            .select('-__v');

        const total = await Song.countDocuments(query);

        res.json({
            songs,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / parseInt(limit)),
                totalSongs: total,
                hasNext: skip + songs.length < total,
                hasPrev: parseInt(page) > 1
            }
        });
    } catch (error) {
        console.error('Get songs error:', error);
        res.status(500).json({
            message: 'Failed to fetch songs',
            error: error.message
        });
    }
});

// Get song by ID
router.get('/:id', optionalAuth, async (req, res) => {
    try {
        const song = await Song.findById(req.params.id).select('-__v');

        if (!song || !song.isActive) {
            return res.status(404).json({
                message: 'Song not found'
            });
        }

        res.json(song);
    } catch (error) {
        console.error('Get song error:', error);
        res.status(500).json({
            message: 'Failed to fetch song',
            error: error.message
        });
    }
});

// Create new song
router.post('/', authenticateToken, [
    body('songUrl').isURL().withMessage('Valid song URL is required'),
    body('title').trim().notEmpty().isLength({ max: 200 }).withMessage('Title is required (max 200 characters)'),
    body('artist').trim().notEmpty().isLength({ max: 200 }).withMessage('Artist is required (max 200 characters)'),
    body('duration').optional().isNumeric().isFloat({ min: 0 }).withMessage('Duration must be a positive number'),
    body('albumArt').optional().isURL().withMessage('Album art must be a valid URL'),
    body('genre').optional().trim().isLength({ max: 50 }).withMessage('Genre max 50 characters'),
    body('album').optional().trim().isLength({ max: 200 }).withMessage('Album max 200 characters'),
    body('releaseYear').optional().isInt({ min: 1900, max: new Date().getFullYear() + 1 }).withMessage('Invalid release year'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            message: 'Validation failed',
            errors: errors.array()
        });
    }

    try {
        const songData = {
            ...req.body,
            createdBy: req.user._id
        };

        const song = new Song(songData);
        await song.save();

        // Invalidate relevant caches
        await cacheService.delByPattern('songs:*');
        await cacheService.delByPattern('popular:*');

        res.status(201).json({
            message: 'Song created successfully',
            song
        });
    } catch (error) {
        console.error('Create song error:', error);

        if (error.code === 11000) {
            return res.status(409).json({
                message: 'Song URL already exists'
            });
        }

        res.status(500).json({
            message: 'Failed to create song',
            error: error.message
        });
    }
});

// Update song
router.put('/:id', authenticateToken, [
    body('title').optional().trim().notEmpty().isLength({ max: 200 }),
    body('artist').optional().trim().notEmpty().isLength({ max: 200 }),
    body('duration').optional().isNumeric().isFloat({ min: 0 }),
    body('albumArt').optional().isURL(),
    body('genre').optional().trim().isLength({ max: 50 }),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            message: 'Validation failed',
            errors: errors.array()
        });
    }

    try {
        const song = await Song.findById(req.params.id);

        if (!song) {
            return res.status(404).json({
                message: 'Song not found'
            });
        }

        // Update fields
        Object.keys(req.body).forEach(key => {
            if (req.body[key] !== undefined) {
                song[key] = req.body[key];
            }
        });

        await song.save();

        // Invalidate caches
        await cacheService.delByPattern(`song:${song._id}:*`);
        await cacheService.delByPattern('songs:*');

        res.json({
            message: 'Song updated successfully',
            song
        });
    } catch (error) {
        console.error('Update song error:', error);
        res.status(500).json({
            message: 'Failed to update song',
            error: error.message
        });
    }
});

// Delete song
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const song = await Song.findById(req.params.id);

        if (!song) {
            return res.status(404).json({
                message: 'Song not found'
            });
        }

        // Soft delete
        song.isActive = false;
        await song.save();

        // Invalidate caches
        await cacheService.delByPattern(`song:${song._id}:*`);
        await cacheService.delByPattern('songs:*');

        res.json({
            message: 'Song deleted successfully'
        });
    } catch (error) {
        console.error('Delete song error:', error);
        res.status(500).json({
            message: 'Failed to delete song',
            error: error.message
        });
    }
});

// Play song (increment play count and record history)
router.post('/:id/play', authenticateToken, async (req, res) => {
    try {
        const { playDuration = 0, completedPercentage = 0 } = req.body;

        const song = await Song.findById(req.params.id);

        if (!song || !song.isActive) {
            return res.status(404).json({
                message: 'Song not found'
            });
        }

        // Increment play count
        await song.incrementPlayCount();

        // Record play history
        const playHistory = new PlayHistory({
            user: req.user._id,
            song: song._id,
            playDuration,
            completedPercentage,
            deviceInfo: {
                userAgent: req.get('User-Agent'),
                platform: req.get('Sec-Ch-Ua-Platform'),
            },
            sessionId: req.sessionID
        });

        await playHistory.save();

        // Invalidate caches
        await cacheService.delByPattern(`song:${song._id}:*`);
        await cacheService.delByPattern('popular:*');
        await cacheService.delByPattern(`user:${req.user._id}:history`);

        res.json({
            message: 'Play recorded successfully',
            song: {
                _id: song._id,
                title: song.title,
                artist: song.artist,
                songUrl: song.songUrl,
                albumArt: song.albumArt,
                duration: song.duration,
                playCount: song.playCount
            }
        });
    } catch (error) {
        console.error('Play song error:', error);
        res.status(500).json({
            message: 'Failed to record play',
            error: error.message
        });
    }
});

// Get popular songs
router.get('/popular/list', optionalAuth, async (req, res) => {
    try {
        const { limit = 10 } = req.query;

        // Check cache first
        const cacheKey = `popular:songs:${limit}`;
        const cached = await cacheService.get(cacheKey);

        if (cached) {
            return res.json(cached);
        }

        const songs = await Song.findPopular(parseInt(limit));

        // Cache for 1 hour
        await cacheService.set(cacheKey, songs, 3600);

        res.json(songs);
    } catch (error) {
        console.error('Get popular songs error:', error);
        res.status(500).json({
            message: 'Failed to fetch popular songs',
            error: error.message
        });
    }
});

// Search songs
router.get('/search/query', optionalAuth, async (req, res) => {
    try {
        const { q: query, limit = 20 } = req.query;

        if (!query || query.trim().length < 2) {
            return res.status(400).json({
                message: 'Search query must be at least 2 characters'
            });
        }

        // Check cache first
        const cacheKey = `search:songs:${query.toLowerCase()}:${limit}`;
        const cached = await cacheService.get(cacheKey);

        if (cached) {
            return res.json(cached);
        }

        const songs = await Song.searchSongs(query.trim(), parseInt(limit));

        // Cache for 15 minutes
        await cacheService.set(cacheKey, songs, 900);

        res.json(songs);
    } catch (error) {
        console.error('Search songs error:', error);
        res.status(500).json({
            message: 'Failed to search songs',
            error: error.message
        });
    }
});

// Get song statistics
router.get('/:id/stats', authenticateToken, async (req, res) => {
    try {
        const song = await Song.findById(req.params.id);

        if (!song) {
            return res.status(404).json({
                message: 'Song not found'
            });
        }

        const stats = await PlayHistory.getSongStats(song._id);

        res.json({
            song: {
                _id: song._id,
                title: song.title,
                artist: song.artist,
                playCount: song.playCount
            },
            statistics: stats[0] || {
                totalPlays: 0,
                uniqueUsers: 0,
                avgPlayDuration: 0,
                avgCompletionRate: 0,
                lastPlayed: null
            }
        });
    } catch (error) {
        console.error('Get song stats error:', error);
        res.status(500).json({
            message: 'Failed to fetch song statistics',
            error: error.message
        });
    }
});

export default router;