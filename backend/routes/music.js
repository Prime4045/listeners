import express from 'express';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import Song from '../models/Song.js';
import UserLikes from '../models/UserLikes.js';
import UserLibrary from '../models/UserLibrary.js';
import PlayHistory from '../models/PlayHistory.js';
import User from '../models/User.js';
import spotifyService from '../services/spotifyService.js';
import audioOptimizationService from '../services/audioOptimization.js';
import cacheService from '../services/cacheService.js';
import s3Service from '../config/s3.js';

const router = express.Router();

// Get all songs from database (for Available Songs section)
router.get('/database/songs', optionalAuth, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const cacheKey = `db_songs:${page}:${limit}`;
    const cachedSongs = await cacheService.getCachedDatabaseSongs(cacheKey);
    if (cachedSongs) {
      console.log('Returning cached database songs:', { cacheKey });
      return res.json(cachedSongs);
    }

    const songs = await Song.getAllSongs(parseInt(limit), skip);
    const total = await Song.countDocuments({ isActive: true });

    const result = {
      songs: songs.map(song => ({
        spotifyId: song.spotifyId,
        title: song.title,
        artist: song.artist,
        album: song.album,
        duration: song.duration,
        imageUrl: song.imageUrl,
        audioUrl: song.audioUrl,
        playCount: song.playCount,
        likeCount: song.likeCount,
        popularity: song.popularity,
        explicit: song.explicit,
        releaseDate: song.releaseDate,
        genre: song.genre,
        isInDatabase: true,
        canPlay: true,
        spotifyData: song.spotifyData,
      })),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalSongs: total,
        hasNext: skip + songs.length < total,
        hasPrev: parseInt(page) > 1,
      }
    };

    await cacheService.cacheDatabaseSongs(result, cacheKey, 30 * 60);
    res.json(result);
  } catch (error) {
    console.error('Database songs error:', error.message);
    res.status(500).json({
      message: 'Failed to fetch songs from database',
      error: error.message
    });
  }
});

// Search music (Spotify API with S3 availability check)
router.get('/search', optionalAuth, async (req, res) => {
  try {
    const { q: query, limit = 20 } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        message: 'Query parameter is required and must be at least 2 characters long'
      });
    }

    const searchLimit = Math.min(parseInt(limit) || 20, 50);
    const cacheKey = `spotify_search:${query.trim()}:${searchLimit}`;
    // Check cache first
    let spotifyTracks = await cacheService.getCachedSpotifySearch(cacheKey);

    if (!spotifyTracks) {
      try {
        spotifyTracks = await spotifyService.searchTracks(query.trim(), searchLimit);
        await cacheService.cacheSpotifySearch(cacheKey, spotifyTracks, 15 * 60);
      } catch (spotifyError) {
        console.log('Spotify search failed, using mock data');
        spotifyTracks = spotifyService.getMockTrendingTracks(searchLimit).filter(track => 
          track.title.toLowerCase().includes(query.toLowerCase()) ||
          track.artist.toLowerCase().includes(query.toLowerCase())
        );
      }
    } else {
      console.log('Using cached Spotify search results:', { query, count: spotifyTracks.length });
    }

    // Mark all tracks as playable with mock audio
    const tracksWithPlayability = spotifyTracks.map(track => ({
      ...track,
      isInDatabase: false,
      canPlay: true, // All tracks playable with mock audio
      message: null
    }));

    res.json({
      songs: tracksWithPlayability,
      source: 'spotify',
      query: query.trim(),
      total: tracksWithPlayability.length,
      availableCount: tracksWithPlayability.length,
    });
  } catch (error) {
    console.error('Search error:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({
      message: 'Failed to search songs',
      error: error.message
    });
  }
});

// Play a song (main endpoint for audio playback) - Allow guest access
router.post('/:spotifyId/play', optionalAuth, async (req, res) => {
  try {
    const { spotifyId } = req.params;
    const { playDuration = 0, completedPercentage = 0 } = req.body;

    console.log(`Play request for track: ${spotifyId}`, {
      authenticated: !!req.user,
      userId: req.user?._id
    });

    // For now, return mock audio data since S3 is not configured
    const mockAudioUrl = 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav';
    
    // Check if song exists in database first
    let song = await Song.findOne({ spotifyId });

    if (song) {
      // Song exists in database, use mock audio URL
      try {
        song.audioUrl = mockAudioUrl;
        await song.incrementPlayCount();
        await song.save();

        // Record play history only if user is authenticated
        if (req.user) {
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
        }

        const songData = {
          spotifyId: song.spotifyId,
          title: song.title,
          artist: song.artist,
          album: song.album,
          duration: song.duration,
          imageUrl: song.imageUrl,
          audioUrl: mockAudioUrl,
          playCount: song.playCount,
          likeCount: song.likeCount,
          popularity: song.popularity,
          explicit: song.explicit,
          releaseDate: song.releaseDate,
          genre: song.genre,
          isInDatabase: true,
          canPlay: true,
          spotifyData: song.spotifyData,
        };

        await cacheService.cacheSong(spotifyId, songData);
        return res.json(songData);
      } catch (error) {
        console.error('Error playing existing song:', error.message);
      }
    }

    // Fetch track metadata from Spotify
    console.log('Fetching track metadata from Spotify:', spotifyId);
    const spotifyTrack = await spotifyService.getTrack(spotifyId);

    // Create new song in database with upsert to handle duplicates
    song = await Song.findOneAndUpdate(
      { spotifyId: spotifyTrack.spotifyId },
      {
        spotifyId: spotifyTrack.spotifyId,
        title: spotifyTrack.title,
        artist: spotifyTrack.artist,
        album: spotifyTrack.album,
        duration: spotifyTrack.duration,
        imageUrl: spotifyTrack.imageUrl,
        audioUrl: mockAudioUrl,
        genre: spotifyTrack.genre || null,
        releaseDate: spotifyTrack.releaseDate,
        popularity: spotifyTrack.popularity,
        explicit: spotifyTrack.explicit,
        spotifyData: spotifyTrack.spotifyData,
        s3Key: spotifyId,
        audioMetadata: null,
        $inc: { playCount: 1 },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );

    // Record play history only if user is authenticated
    if (req.user) {
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
    }

    const songData = {
      spotifyId: song.spotifyId,
      title: song.title,
      artist: song.artist,
      album: song.album,
      duration: song.duration,
      imageUrl: song.imageUrl,
      audioUrl: mockAudioUrl,
      playCount: song.playCount,
      likeCount: song.likeCount,
      popularity: song.popularity,
      explicit: song.explicit,
      releaseDate: song.releaseDate,
      genre: song.genre,
      isInDatabase: true,
      canPlay: true,
      isNewlyAdded: true,
      spotifyData: song.spotifyData,
    };

    await cacheService.cacheSong(spotifyId, songData);
    await cacheService.invalidateSearchCaches();

    console.log('Successfully created and played new song:', spotifyId);
    res.json(songData);
  } catch (error) {
    console.error('Play error:', {
      spotifyId: req.params.spotifyId,
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({
      message: 'Failed to play song',
      error: error.message
    });
  }
});

// Get song details
router.get('/:spotifyId', optionalAuth, async (req, res) => {
  try {
    const { spotifyId } = req.params;

    // Check cache first
    const cachedSong = await cacheService.getCachedSong(spotifyId);
    if (cachedSong) {
      let isLiked = false;
      if (req.user && cachedSong.isInDatabase) {
        const song = await Song.findOne({ spotifyId });
        if (song) {
          isLiked = !!(await UserLikes.isLikedByUser(req.user._id, song._id));
        }
      }
      return res.json({ ...cachedSong, isLiked });
    }

    // Check database first
    const song = await Song.findOne({ spotifyId });

    if (song) {
      const songData = {
        spotifyId: song.spotifyId,
        title: song.title,
        artist: song.artist,
        album: song.album,
        duration: song.duration,
        imageUrl: song.imageUrl,
        audioUrl: song.audioUrl,
        playCount: song.playCount,
        likeCount: song.likeCount,
        popularity: song.popularity,
        explicit: song.explicit,
        releaseDate: song.releaseDate,
        genre: song.genre,
        isInDatabase: true,
        canPlay: true,
        spotifyData: song.spotifyData,
      };

      let isLiked = false;
      if (req.user) {
        isLiked = !!(await UserLikes.isLikedByUser(req.user._id, song._id));
      }

      await cacheService.cacheSong(spotifyId, songData);
      res.json({ ...songData, isLiked });
    } else {
      // Fetch from Spotify
      const spotifyTrack = await spotifyService.getTrack(spotifyId);

      // Check S3 availability
      const s3CacheKey = `s3_check:${spotifyId}`;
      let audioExists = await cacheService.getCachedS3Check(s3CacheKey);

      if (audioExists === null) {
        audioExists = await s3Service.audioExists(spotifyId);
        await cacheService.cacheS3Check(s3CacheKey, audioExists, 60 * 60);
      }

      const songData = {
        spotifyId: spotifyTrack.spotifyId,
        title: spotifyTrack.title,
        artist: spotifyTrack.artist,
        album: spotifyTrack.album,
        duration: spotifyTrack.duration,
        imageUrl: spotifyTrack.imageUrl,
        popularity: spotifyTrack.popularity,
        explicit: spotifyTrack.explicit,
        releaseDate: spotifyTrack.releaseDate,
        previewUrl: spotifyTrack.previewUrl,
        genre: spotifyTrack.genre,
        isInDatabase: false,
        canPlay: audioExists,
        isLiked: false,
        spotifyData: spotifyTrack.spotifyData,
        message: audioExists ? null : 'Song not available for playback yet'
      };

      res.json(songData);
    }
  } catch (error) {
    console.error('Get song error:', error.message);
    res.status(500).json({
      message: 'Failed to get song',
      error: error.message
    });
  }
});

// Get trending songs
router.get('/database/trending', optionalAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const cacheKey = `trending_songs:${limit}`;
    const cachedSongs = await cacheService.getCachedPopularSongs(cacheKey);

    if (cachedSongs) {
      console.log('Returning cached trending songs:', { cacheKey });
      return res.json(cachedSongs.slice(0, limit));
    }

    // Try to get trending from Spotify, fallback to mock data
    let formattedSongs = [];
    
    try {
      const spotifyTracks = await spotifyService.getTrendingTracks(limit);
      
      formattedSongs = spotifyTracks.map(track => ({
        spotifyId: track.spotifyId,
        title: track.title,
        artist: track.artist,
        album: track.album,
        duration: track.duration,
        imageUrl: track.imageUrl,
        playCount: 0,
        likeCount: 0,
        popularity: track.popularity,
        explicit: track.explicit,
        releaseDate: track.releaseDate,
        genre: track.genre,
        isInDatabase: false,
        canPlay: true, // Allow all tracks to be playable with mock audio
        spotifyData: track.spotifyData,
      }));
    } catch (spotifyError) {
      console.log('Spotify API failed, using mock trending data');
      formattedSongs = spotifyService.getMockTrendingTracks(limit);
    }

    await cacheService.cachePopularSongs(formattedSongs, cacheKey, 60 * 60);
    res.json(formattedSongs.slice(0, limit));
  } catch (error) {
    console.error('Trending songs error:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({
      message: 'Failed to fetch trending songs',
      error: error.message
    });
  }
});

// Like/unlike a song - Requires authentication
router.post('/:spotifyId/like', authenticateToken, async (req, res) => {
  try {
    const { spotifyId } = req.params;

    const song = await Song.findOne({ spotifyId });
    if (!song) {
      return res.status(404).json({
        message: 'Song must be played first before liking'
      });
    }

    const result = await UserLikes.likeSong(req.user._id, song._id);

    // Update song like count
    if (result.liked) {
      song.likeCount += 1;
      // Add to user's liked songs array
      await User.findByIdAndUpdate(req.user._id, {
        $addToSet: { likedSongs: song._id }
      });
    } else {
      song.likeCount = Math.max(0, song.likeCount - 1);
      // Remove from user's liked songs array
      await User.findByIdAndUpdate(req.user._id, {
        $pull: { likedSongs: song._id }
      });
    }
    await song.save();

    await cacheService.invalidateSongCaches(spotifyId);
    res.json(result);
  } catch (error) {
    console.error('Like song error:', error.message);
    res.status(500).json({
      message: 'Failed to like/unlike song',
      error: error.message
    });
  }
});

// Add/remove song from user library - Requires authentication
router.post('/:spotifyId/library', authenticateToken, async (req, res) => {
  try {
    const { spotifyId } = req.params;

    const song = await Song.findOne({ spotifyId });
    if (!song) {
      return res.status(404).json({
        message: 'Song must be played first before adding to library'
      });
    }

    const result = await UserLibrary.addToLibrary(req.user._id, song._id);
    res.json(result);
  } catch (error) {
    console.error('Add to library error:', error.message);
    res.status(500).json({
      message: 'Failed to add/remove song from library',
      error: error.message
    });
  }
});

router.delete('/:spotifyId/library', authenticateToken, async (req, res) => {
  try {
    const { spotifyId } = req.params;

    const song = await Song.findOne({ spotifyId });
    if (!song) {
      return res.status(404).json({
        message: 'Song not found'
      });
    }

    const result = await UserLibrary.removeFromLibrary(req.user._id, song._id);
    res.json(result);
  } catch (error) {
    console.error('Remove from library error:', error.message);
    res.status(500).json({
      message: 'Failed to remove song from library',
      error: error.message
    });
  }
});

// Get user's liked songs - Requires authentication
router.get('/user/liked', authenticateToken, async (req, res) => {
  try {
    const { limit = 50, skip = 0 } = req.query;

    const likedSongs = await UserLikes.getUserLikedSongs(
      req.user._id,
      parseInt(limit),
      parseInt(skip)
    );

    const songs = likedSongs.map(like => ({
      spotifyId: like.song.spotifyId,
      title: like.song.title,
      artist: like.song.artist,
      album: like.song.album,
      duration: like.song.duration,
      imageUrl: like.song.imageUrl,
      audioUrl: like.song.audioUrl,
      likedAt: like.likedAt,
      playCount: like.song.playCount,
      likeCount: like.song.likeCount,
      popularity: like.song.popularity,
      explicit: like.song.explicit,
      releaseDate: like.song.releaseDate,
      genre: like.song.genre,
      isInDatabase: true,
      canPlay: true,
      spotifyData: like.song.spotifyData,
    }));

    res.json(songs);
  } catch (error) {
    console.error('Get liked songs error:', error.message);
    res.status(500).json({
      message: 'Failed to get liked songs',
      error: error.message
    });
  }
});

// Get user's library - Requires authentication
router.get('/user/library', authenticateToken, async (req, res) => {
  try {
    const { limit = 50, skip = 0 } = req.query;

    const librarySongs = await UserLibrary.getUserLibrary(
      req.user._id,
      parseInt(limit),
      parseInt(skip)
    );

    const songs = librarySongs.map(library => ({
      spotifyId: library.song.spotifyId,
      title: library.song.title,
      artist: library.song.artist,
      album: library.song.album,
      duration: library.song.duration,
      imageUrl: library.song.imageUrl,
      audioUrl: library.song.audioUrl,
      addedAt: library.addedAt,
      playCount: library.song.playCount,
      likeCount: library.song.likeCount,
      popularity: library.song.popularity,
      explicit: library.song.explicit,
      releaseDate: library.song.releaseDate,
      genre: library.song.genre,
      isInDatabase: true,
      canPlay: true,
      spotifyData: library.song.spotifyData,
    }));

    res.json(songs);
  } catch (error) {
    console.error('Get user library error:', error.message);
    res.status(500).json({
      message: 'Failed to get user library',
      error: error.message
    });
  }
});

// Get user's play history - Requires authentication
router.get('/user/history', authenticateToken, async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const history = await PlayHistory.getUserHistory(req.user._id, parseInt(limit));

    const formattedHistory = history.map(entry => ({
      spotifyId: entry.song.spotifyId,
      title: entry.song.title,
      artist: entry.song.artist,
      album: entry.song.album,
      duration: entry.song.duration,
      imageUrl: entry.song.imageUrl,
      playedAt: entry.playedAt,
      playDuration: entry.playDuration,
      completedPercentage: entry.completedPercentage,
      spotifyData: entry.song.spotifyData,
    }));

    res.json(formattedHistory);
  } catch (error) {
    console.error('Get play history error:', error.message);
    res.status(500).json({
      message: 'Failed to get play history',
      error: error.message
    });
  }
});

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    const [spotifyHealth, audioHealth, cacheHealth] = await Promise.allSettled([
      spotifyService.healthCheck(),
      audioOptimizationService.healthCheck(),
      cacheService.healthCheck(),
    ]);

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        spotify: spotifyHealth.status === 'fulfilled' ? spotifyHealth.value : { status: 'unhealthy', error: spotifyHealth.reason?.message },
        audio: audioHealth.status === 'fulfilled' ? audioHealth.value : { status: 'unhealthy', error: audioHealth.reason?.message },
        cache: cacheHealth.status === 'fulfilled' ? cacheHealth.value : { status: 'unhealthy', error: cacheHealth.reason?.message },
      }
    };

    // Overall health status
    const allHealthy = Object.values(health.services).every(service => service.status === 'healthy');
    health.status = allHealthy ? 'healthy' : 'degraded';

    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;