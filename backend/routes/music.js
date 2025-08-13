import express from 'express';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import Song from '../models/Song.js';
import UserLikes from '../models/UserLikes.js';
import UserLibrary from '../models/UserLibrary.js';
import PlayHistory from '../models/PlayHistory.js';
import User from '../models/User.js';
import spotifyService from '../services/spotifyService.js';
import s3Service from '../config/s3.js';
import cacheService from '../services/cacheService.js';

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
    
    // First search in database
    console.log('Searching in database first for:', query.trim());
    const dbSongs = await Song.searchInDatabase(query.trim(), Math.min(searchLimit, 20));
    
    // Format database songs
    const dbResults = dbSongs.map(song => ({
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
    }));
    
    console.log(`Found ${dbResults.length} songs in database`);
    
    // If we have enough results from database, return them
    if (dbResults.length >= searchLimit) {
      return res.json({
        songs: dbResults.slice(0, searchLimit),
        source: 'database',
        query: query.trim(),
        total: dbResults.length,
        availableCount: dbResults.length,
      });
    }
    
    // Search Spotify for additional results
    const remainingLimit = searchLimit - dbResults.length;
    const cacheKey = `spotify_search:${query.trim()}:${remainingLimit}`;
    // Check cache first
    let spotifyTracks = await cacheService.getCachedSpotifySearch(cacheKey);

    if (!spotifyTracks) {
      console.log('Searching Spotify for additional results...');
      spotifyTracks = await spotifyService.searchTracks(query.trim(), remainingLimit);
      
      // Filter out tracks that are already in database
      const dbSpotifyIds = new Set(dbResults.map(song => song.spotifyId));
      spotifyTracks = spotifyTracks.filter(track => !dbSpotifyIds.has(track.spotifyId));
      
      await cacheService.cacheSpotifySearch(cacheKey, spotifyTracks, 15 * 60);
    } else {
      console.log('Using cached Spotify search results:', { query: query.trim(), count: spotifyTracks.length });
    }

    // Check S3 availability for each track
    const tracksWithS3Check = await Promise.all(
      spotifyTracks.map(async (track) => {
        const s3CacheKey = `s3_check:${track.spotifyId}`;
        let audioExists = await cacheService.getCachedS3Check(s3CacheKey);

        if (audioExists === null) {
          audioExists = await s3Service.audioExists(track.spotifyId);
          await cacheService.cacheS3Check(s3CacheKey, audioExists, 60 * 60);
        }

        return {
          ...track,
          isInDatabase: false,
          canPlay: audioExists,
          message: audioExists ? null : 'Song not available for playback yet'
        };
      })
    );

    // Combine database and Spotify results
    const allResults = [...dbResults, ...tracksWithS3Check];
    
    res.json({
      songs: allResults.slice(0, searchLimit),
      source: dbResults.length > 0 ? 'mixed' : 'spotify',
      query: query.trim(),
      total: allResults.length,
      availableCount: allResults.filter(t => t.canPlay).length,
      databaseCount: dbResults.length,
      spotifyCount: tracksWithS3Check.length,
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

    console.log(`Play request for track: ${spotifyId}`);

    // Check if song exists in database first
    let song = await Song.findOne({ spotifyId });

    if (song) {
      // Song exists in database, generate fresh S3 URL
      try {
        const audioUrl = await s3Service.getAudioUrl(spotifyId);
        song.audioUrl = audioUrl;
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

        await cacheService.cacheSong(spotifyId, songData);
        return res.json(songData);
      } catch (s3Error) {
        console.error('S3 error for existing song:', s3Error.message);
        return res.status(404).json({
          message: 'Audio file not available',
          code: 'AUDIO_NOT_FOUND',
          spotifyId
        });
      }
    }

    // Song not in database, check S3 availability
    const s3CacheKey = `s3_check:${spotifyId}`;
    let audioExists = await cacheService.getCachedS3Check(s3CacheKey);

    if (audioExists === null) {
      audioExists = await s3Service.audioExists(spotifyId);
      await cacheService.cacheS3Check(s3CacheKey, audioExists, 60 * 60);
    }

    if (!audioExists) {
      return res.status(404).json({
        message: 'Audio file not found in our library. Song will be added soon!',
        code: 'AUDIO_NOT_FOUND',
        spotifyId
      });
    }

    // Fetch track metadata from Spotify
    console.log('Fetching track metadata from Spotify:', spotifyId);
    const spotifyTrack = await spotifyService.getTrack(spotifyId);

    // Generate S3 signed URL
    const audioUrl = await s3Service.getAudioUrl(spotifyId);
    
    // Get file metadata with fallback
    let fileMetadata;
    try {
      fileMetadata = await s3Service.getFileMetadata(spotifyId);
    } catch (metadataError) {
      console.warn('Failed to get file metadata, using defaults:', metadataError.message);
      fileMetadata = {
        size: 0,
        lastModified: new Date(),
        contentType: 'audio/mpeg',
        etag: null,
      };
    }

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
        audioUrl: audioUrl,
        genre: spotifyTrack.genre || null,
        releaseDate: spotifyTrack.releaseDate,
        popularity: spotifyTrack.popularity,
        explicit: spotifyTrack.explicit,
        spotifyData: spotifyTrack.spotifyData,
        s3Key: spotifyId,
        audioMetadata: fileMetadata,
        playCount: 1,
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );

    // Increment play count if it's an existing song
    if (!song.isNew) {
      song.playCount += 1;
      await song.save();
    }

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
      audioUrl: song.audioUrl,
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

    // Get trending from Spotify
    const spotifyTracks = await spotifyService.getTrendingTracks(limit);

    // Check S3 availability and database status
    const formattedSongs = await Promise.all(
      spotifyTracks.map(async (track) => {
        const s3CacheKey = `s3_check:${track.spotifyId}`;
        let audioExists = await cacheService.getCachedS3Check(s3CacheKey);

        if (audioExists === null) {
          audioExists = await s3Service.audioExists(track.spotifyId);
          await cacheService.cacheS3Check(s3CacheKey, audioExists, 60 * 60);
        }

        const song = await Song.findOne({ spotifyId: track.spotifyId });

        return {
          spotifyId: track.spotifyId,
          title: track.title,
          artist: track.artist,
          album: track.album,
          duration: track.duration,
          imageUrl: track.imageUrl,
          playCount: song ? song.playCount : 0,
          likeCount: song ? song.likeCount : 0,
          popularity: track.popularity,
          explicit: track.explicit,
          releaseDate: track.releaseDate,
          genre: track.genre,
          isInDatabase: !!song,
          canPlay: audioExists,
          spotifyData: track.spotifyData,
          message: audioExists ? null : 'Song not available for playback yet'
        };
      })
    );

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
    const [spotifyHealth, s3Health, cacheHealth] = await Promise.allSettled([
      spotifyService.healthCheck(),
      s3Service.healthCheck(),
      cacheService.healthCheck(),
    ]);

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        spotify: spotifyHealth.status === 'fulfilled' ? spotifyHealth.value : { status: 'unhealthy', error: spotifyHealth.reason?.message },
        s3: s3Health.status === 'fulfilled' ? s3Health.value : { status: 'unhealthy', error: s3Health.reason?.message },
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