import express from 'express';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import Song from '../models/Song.js';
import UserLikes from '../models/UserLikes.js';
import spotifyService from '../services/spotifyService.js';
import s3Service from '../config/s3.js';
import cacheService from '../services/cacheService.js';

const router = express.Router();

// Get all songs from database (for Available Songs section)
router.get('/database/songs', optionalAuth, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const cacheKey = `db_songs:${page}`;
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

// Search music (Spotify only)
router.get('/search', optionalAuth, async (req, res) => {
  try {
    const { query, limit = 20 } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        message: 'Query parameter is required and must be at least 2 characters long'
      });
    }

    const searchLimit = Math.min(parseInt(limit) || 20, 50);
    const cacheKey = `spotify_search:${query.trim()}`;
    let spotifyTracks = await cacheService.getCachedSpotifySearch(cacheKey);

    if (!spotifyTracks) {
      spotifyTracks = await spotifyService.searchTracks(query.trim(), searchLimit);
      console.log('Spotify tracks fetched:', { query, count: spotifyTracks.length });
      await cacheService.cacheSpotifySearch(cacheKey, spotifyTracks, 15 * 60);
    } else {
      console.log('Using cached Spotify search results:', { query, count: spotifyTracks.length });
    }

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
          message: audioExists ? null : 'Song not added yet, will be available soon!'
        };
      })
    );

    res.json({
      songs: tracksWithS3Check,
      source: 'spotify',
      spotifyCount: tracksWithS3Check.length,
      databaseCount: 0,
      total: tracksWithS3Check.length
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

// Play a song
router.post('/:spotifyId/play', authenticateToken, async (req, res) => {
  try {
    const { spotifyId } = req.params;

    let song = await Song.findOne({ spotifyId });

    if (song) {
      const audioUrl = await s3Service.getAudioUrl(spotifyId);
      song.audioUrl = audioUrl;
      await song.incrementPlayCount();
      await song.save();

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
    }

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

    const spotifyTrack = await spotifyService.getTrack(spotifyId);
    const audioUrl = await s3Service.getAudioUrl(spotifyId);
    const fileMetadata = await s3Service.getFileMetadata(spotifyId);

    song = new Song({
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
      s3Key: `${spotifyId}.mp3`,
      audioMetadata: fileMetadata,
      playCount: 1,
    });

    await song.save();

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

    res.json(songData);
  } catch (error) {
    console.error('Play error:', {
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
      const spotifyTrack = await spotifyService.getTrack(spotifyId);

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
        message: audioExists ? null : 'Song not added yet, will be available soon!'
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

// Get trending songs from Spotify
router.get('/database/trending', optionalAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const cacheKey = `trending_songs:${limit}`;
    const cachedSongs = await cacheService.getCachedPopularSongs(cacheKey);

    if (cachedSongs) {
      console.log('Returning cached trending songs:', { cacheKey });
      return res.json(cachedSongs.slice(0, limit));
    }

    const spotifyTracks = await spotifyService.getTrendingTracks(limit);
    console.log('Trending tracks fetched from Spotify:', { count: spotifyTracks.length });

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
          message: audioExists ? null : 'Song not added yet, will be available soon!'
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

// Like/unlike a song
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

    if (result.liked) {
      song.likeCount += 1;
    } else {
      song.likeCount = Math.max(0, song.likeCount - 1);
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

// Get user's liked songs
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

export default router;