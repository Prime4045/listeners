import express from 'express';
import { Buffer } from 'buffer';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import Song from '../models/Song.js';
import User from '../models/User.js';
import UserLikes from '../models/UserLikes.js';
import cloudinaryService from '../services/cloudinaryService.js';
import cacheService from '../services/cacheService.js';

const router = express.Router();

let accessToken = null;
let tokenExpiresAt = 0;

// Get Spotify access token
const getAccessToken = async () => {
  if (accessToken && tokenExpiresAt > Date.now()) {
    return accessToken;
  }

  try {
    const authString = Buffer.from(
      `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
    ).toString('base64');

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authString}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `HTTP error! Status: ${response.status}, Message: ${errorData.error_description || 'Unknown error'}`
      );
    }

    const data = await response.json();
    accessToken = data.access_token;
    tokenExpiresAt = Date.now() + data.expires_in * 1000 - 60000;
    console.log('Spotify access token obtained successfully');
    return accessToken;
  } catch (error) {
    console.error('Spotify token error:', error.message);
    throw new Error('Failed to obtain Spotify access token');
  }
};

// Fetch trending songs with caching
router.get('/trending-songs', optionalAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    // Check cache first
    const cachedSongs = await cacheService.getTrendingSongs();
    if (cachedSongs && cachedSongs.length > 0) {
      console.log('Returning cached trending songs');
      return res.json(cachedSongs.slice(0, limit));
    }

    const accessToken = await getAccessToken();
    const playlistId = '2fxEEA6a9CPP5CmIJyaIM8'; // Hot Hits Hindi

    const response = await fetch(
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks?market=IN&limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `HTTP error! Status: ${response.status}, Message: ${errorData.error?.message || 'Unknown error'}`
      );
    }

    const data = await response.json();
    const tracks = data.items
      .filter(item => item.track && item.track.id)
      .map((item) => ({
        spotifyId: item.track.id,
        title: item.track.name,
        artist: item.track.artists.map((artist) => artist.name).join(', '),
        album: item.track.album.name,
        duration: item.track.duration_ms,
        releaseDate: item.track.album.release_date ? new Date(item.track.album.release_date) : null,
        previewUrl: item.track.preview_url,
        imageUrl: item.track.album.images[0]?.url || null,
        popularity: item.track.popularity || 0,
        explicit: item.track.explicit || false,
        genres: item.track.album.genres || [],
      }));

    // Save tracks to database and get Cloudinary URLs if available
    const processedTracks = [];
    for (const track of tracks) {
      try {
        let existingSong = await Song.findOne({ spotifyId: track.spotifyId });

        if (!existingSong) {
          existingSong = new Song(track);
          await existingSong.save();
        } else {
          // Update metadata if needed
          Object.assign(existingSong, track);
          await existingSong.save();
        }

        // Use Cloudinary URL if available, otherwise use preview URL
        const processedTrack = {
          ...track,
          previewUrl: existingSong.getAudioUrl(),
          cloudinaryUrl: existingSong.cloudinaryUrl,
          playCount: existingSong.playCount,
          likeCount: existingSong.likeCount,
        };

        processedTracks.push(processedTrack);
      } catch (dbError) {
        console.error('Database save error for track:', track.spotifyId, dbError.message);
        processedTracks.push(track); // Add original track if DB save fails
      }
    }

    // Cache the results
    await cacheService.cacheTrendingSongs(processedTracks, 30 * 60); // 30 minutes

    console.log(`Total Trending Songs Fetched: ${processedTracks.length}`);
    res.json(processedTracks);
  } catch (error) {
    console.error('Trending songs error:', error.message);
    res.status(500).json({
      message: 'Failed to fetch trending songs',
      error: error.message
    });
  }
});

// Fetch Bollywood albums with caching
router.get('/bollywood-albums', optionalAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    // Check cache first
    const cacheKey = 'bollywood_albums';
    const cachedAlbums = await cacheService.get(cacheKey);
    if (cachedAlbums && cachedAlbums.length > 0) {
      console.log('Returning cached Bollywood albums');
      return res.json(cachedAlbums.slice(0, limit));
    }

    const accessToken = await getAccessToken();

    const response = await fetch(
      `https://api.spotify.com/v1/search?q=bollywood&type=album&market=IN&limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `HTTP error! Status: ${response.status}, Message: ${errorData.error?.message || 'Unknown error'}`
      );
    }

    const data = await response.json();
    const albums = data.albums.items.map((album) => ({
      spotifyId: album.id,
      title: album.name,
      artist: album.artists.map((artist) => artist.name).join(', '),
      releaseDate: album.release_date ? new Date(album.release_date) : null,
      imageUrl: album.images[0]?.url || null,
      totalTracks: album.total_tracks,
      spotifyUrl: album.external_urls.spotify,
    }));

    // Save albums as songs in database for consistency
    for (const album of albums) {
      try {
        await Song.findOneAndUpdate(
          { spotifyId: album.spotifyId },
          {
            spotifyId: album.spotifyId,
            title: album.title,
            artist: album.artist,
            album: album.title,
            duration: 0,
            releaseDate: album.releaseDate,
            previewUrl: null,
            imageUrl: album.imageUrl,
          },
          { upsert: true, new: true }
        );
      } catch (dbError) {
        console.error('Database save error for album:', album.spotifyId, dbError.message);
      }
    }

    // Cache the results
    await cacheService.set(cacheKey, albums, 60 * 60); // 1 hour

    console.log(`Total Bollywood Albums Fetched: ${albums.length}`);
    res.json(albums);
  } catch (error) {
    console.error('Bollywood albums error:', error.message);
    res.status(500).json({
      message: 'Failed to fetch Bollywood albums',
      error: error.message
    });
  }
});

// Enhanced search with caching
router.get('/search', optionalAuth, async (req, res) => {
  try {
    const { query, limit = 20 } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        message: 'Query parameter is required and must be at least 2 characters long'
      });
    }

    const searchLimit = Math.min(parseInt(limit) || 20, 50);

    // Check cache first
    const cachedResults = await cacheService.getSearchResults(query.trim());
    if (cachedResults && cachedResults.length > 0) {
      console.log('Returning cached search results');
      return res.json(cachedResults.slice(0, searchLimit));
    }

    // Search in database first
    const dbResults = await Song.searchSongs(query.trim(), searchLimit);
    if (dbResults.length >= searchLimit) {
      const results = dbResults.map(song => ({
        spotifyId: song.spotifyId,
        title: song.title,
        artist: song.artist,
        album: song.album,
        duration: song.duration,
        previewUrl: song.getAudioUrl(),
        imageUrl: song.imageUrl,
        type: 'track',
        playCount: song.playCount,
        likeCount: song.likeCount,
      }));

      // Cache the results
      await cacheService.cacheSearchResults(query.trim(), results);
      return res.json(results);
    }

    // If not enough results in DB, search Spotify
    const accessToken = await getAccessToken();
    const searchQuery = encodeURIComponent(query.trim());
    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${searchQuery}&type=track,artist,album&market=IN&limit=${searchLimit}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`HTTP error! Status: ${response.status}, Message: ${errorData.error?.message}`);
    }

    const data = await response.json();

    // Process tracks
    const tracks = data.tracks?.items?.map((track) => ({
      spotifyId: track.id,
      title: track.name,
      artist: track.artists.map((artist) => artist.name).join(', '),
      album: track.album.name,
      duration: track.duration_ms,
      releaseDate: track.album.release_date ? new Date(track.album.release_date) : null,
      previewUrl: track.preview_url,
      imageUrl: track.album.images[0]?.url,
      type: 'track',
      popularity: track.popularity || 0,
      explicit: track.explicit || false,
    })) || [];

    // Process artists (get their top tracks)
    const artists = data.artists?.items?.slice(0, 3) || [];
    const artistTracks = [];

    for (const artist of artists) {
      try {
        const topTracksResponse = await fetch(
          `https://api.spotify.com/v1/artists/${artist.id}/top-tracks?market=IN`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (topTracksResponse.ok) {
          const topTracksData = await topTracksResponse.json();
          const topTracks = topTracksData.tracks?.slice(0, 3).map((track) => ({
            spotifyId: track.id,
            title: track.name,
            artist: track.artists.map((artist) => artist.name).join(', '),
            album: track.album.name,
            duration: track.duration_ms,
            releaseDate: track.album.release_date ? new Date(track.album.release_date) : null,
            previewUrl: track.preview_url,
            imageUrl: track.album.images[0]?.url,
            type: 'artist_track',
            popularity: track.popularity || 0,
            explicit: track.explicit || false,
          })) || [];

          artistTracks.push(...topTracks);
        }
      } catch (artistError) {
        console.error(`Error fetching top tracks for artist ${artist.id}:`, artistError.message);
      }
    }

    // Process albums (get first track from each)
    const albums = data.albums?.items?.slice(0, 3) || [];
    const albumTracks = [];

    for (const album of albums) {
      try {
        const albumTracksResponse = await fetch(
          `https://api.spotify.com/v1/albums/${album.id}/tracks?market=IN&limit=1`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (albumTracksResponse.ok) {
          const albumTracksData = await albumTracksResponse.json();
          const firstTrack = albumTracksData.items?.[0];

          if (firstTrack) {
            albumTracks.push({
              spotifyId: firstTrack.id,
              title: firstTrack.name,
              artist: firstTrack.artists.map((artist) => artist.name).join(', '),
              album: album.name,
              duration: firstTrack.duration_ms,
              releaseDate: album.release_date ? new Date(album.release_date) : null,
              previewUrl: firstTrack.preview_url,
              imageUrl: album.images[0]?.url,
              type: 'album_track',
              popularity: 0,
              explicit: firstTrack.explicit || false,
            });
          }
        }
      } catch (albumError) {
        console.error(`Error fetching tracks for album ${album.id}:`, albumError.message);
      }
    }

    // Combine all results and remove duplicates
    const allTracks = [...dbResults.map(song => ({
      spotifyId: song.spotifyId,
      title: song.title,
      artist: song.artist,
      album: song.album,
      duration: song.duration,
      previewUrl: song.getAudioUrl(),
      imageUrl: song.imageUrl,
      type: 'track',
      playCount: song.playCount,
      likeCount: song.likeCount,
    })), ...tracks, ...artistTracks, ...albumTracks];

    const uniqueTracks = allTracks.filter((track, index, self) =>
      index === self.findIndex(t => t.spotifyId === track.spotifyId)
    );

    // Sort by relevance
    const sortedTracks = uniqueTracks.sort((a, b) => {
      const typeOrder = { track: 0, artist_track: 1, album_track: 2 };
      return typeOrder[a.type] - typeOrder[b.type];
    });

    // Save new tracks to database
    for (const track of sortedTracks) {
      if (!dbResults.find(dbTrack => dbTrack.spotifyId === track.spotifyId)) {
        try {
          await Song.findOneAndUpdate(
            { spotifyId: track.spotifyId },
            {
              spotifyId: track.spotifyId,
              title: track.title,
              artist: track.artist,
              album: track.album,
              duration: track.duration,
              releaseDate: track.releaseDate,
              previewUrl: track.previewUrl,
              imageUrl: track.imageUrl,
              popularity: track.popularity,
              explicit: track.explicit,
            },
            { upsert: true, new: true }
          );
        } catch (dbError) {
          console.error('Database save error for search result:', track.spotifyId, dbError.message);
        }
      }
    }

    const finalResults = sortedTracks.slice(0, searchLimit);

    // Cache the results
    await cacheService.cacheSearchResults(query.trim(), finalResults);

    console.log(`Search results for "${query}": ${finalResults.length} tracks found`);
    res.json(finalResults);
  } catch (error) {
    console.error('Search error:', error.message);
    res.status(500).json({
      message: 'Failed to search songs',
      error: error.message
    });
  }
});

// Play a song with analytics
router.post('/:id/play', authenticateToken, async (req, res) => {
  try {
    const songId = req.params.id;
    let song = await Song.findOne({ spotifyId: songId });
    let songData;

    if (!song) {
      // Fetch song from Spotify if not in database
      const accessToken = await getAccessToken();
      const response = await fetch(`https://api.spotify.com/v1/tracks/${songId}?market=IN`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`HTTP error! Status: ${response.status}, Message: ${errorData.error?.message}`);
      }

      const track = await response.json();
      songData = {
        spotifyId: track.id,
        title: track.name,
        artist: track.artists.map((artist) => artist.name).join(', '),
        album: track.album.name,
        duration: track.duration_ms,
        releaseDate: track.album.release_date ? new Date(track.album.release_date) : null,
        previewUrl: track.preview_url,
        imageUrl: track.album.images[0]?.url,
        popularity: track.popularity || 0,
        explicit: track.explicit || false,
      };

      const newSong = new Song(songData);
      await newSong.save();
      song = newSong;
    } else {
      songData = {
        spotifyId: song.spotifyId,
        title: song.title,
        artist: song.artist,
        album: song.album,
        duration: song.duration,
        previewUrl: song.getAudioUrl(),
        imageUrl: song.imageUrl,
        playCount: song.playCount,
        likeCount: song.likeCount,
      };
    }

    // Increment play count
    await song.incrementPlayCount();

    // Update user's recently played
    try {
      // Remove the song if it already exists in recently played
      await User.findByIdAndUpdate(req.user._id, {
        $pull: { recentlyPlayed: { song: song._id } },
      });

      // Add the song to the beginning of recently played
      await User.findByIdAndUpdate(req.user._id, {
        $push: {
          recentlyPlayed: {
            $each: [{
              song: song._id,
              playedAt: new Date(),
            }],
            $position: 0,
            $slice: 50, // Keep only the last 50 tracks
          },
        },
      });

      // Invalidate user's recently played cache
      await cacheService.invalidateUserCaches(req.user._id);
    } catch (userUpdateError) {
      console.error('Error updating user recently played:', userUpdateError.message);
      // Don't fail the request if user update fails
    }

    res.json(songData);
  } catch (error) {
    console.error('Play error:', error.message);
    res.status(500).json({
      message: 'Failed to play song',
      error: error.message
    });
  }
});

// Like/unlike a song
router.post('/:id/like', authenticateToken, async (req, res) => {
  try {
    const songId = req.params.id;

    // Find the song by Spotify ID
    const song = await Song.findOne({ spotifyId: songId });
    if (!song) {
      return res.status(404).json({ message: 'Song not found' });
    }

    const result = await UserLikes.likeSong(req.user._id, song._id);

    // Invalidate relevant caches
    await cacheService.invalidateSongCaches(song._id);
    await cacheService.invalidateUserCaches(req.user._id);

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
router.get('/liked', authenticateToken, async (req, res) => {
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
      previewUrl: like.song.getAudioUrl(),
      imageUrl: like.song.imageUrl,
      likedAt: like.likedAt,
      playCount: like.song.playCount,
      likeCount: like.song.likeCount,
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

// Get song details with like status
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const songId = req.params.id;

    // Check cache first
    const cachedSong = await cacheService.getSongMetadata(songId);
    if (cachedSong) {
      // Check if user liked the song
      let isLiked = false;
      if (req.user) {
        const song = await Song.findOne({ spotifyId: songId });
        if (song) {
          isLiked = !!(await UserLikes.isLikedByUser(req.user._id, song._id));
        }
      }

      return res.json({ ...cachedSong, isLiked });
    }

    let song = await Song.findOne({ spotifyId: songId });

    if (!song) {
      // Fetch from Spotify if not in database
      const accessToken = await getAccessToken();
      const response = await fetch(`https://api.spotify.com/v1/tracks/${songId}?market=IN`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`HTTP error! Status: ${response.status}, Message: ${errorData.error?.message}`);
      }

      const track = await response.json();
      const songData = {
        spotifyId: track.id,
        title: track.name,
        artist: track.artists.map((artist) => artist.name).join(', '),
        album: track.album.name,
        duration: track.duration_ms,
        releaseDate: track.album.release_date ? new Date(track.album.release_date) : null,
        previewUrl: track.preview_url,
        imageUrl: track.album.images[0]?.url,
        popularity: track.popularity || 0,
        explicit: track.explicit || false,
      };

      const newSong = new Song(songData);
      await newSong.save();
      song = newSong;
    }

    const songData = {
      spotifyId: song.spotifyId,
      title: song.title,
      artist: song.artist,
      album: song.album,
      duration: song.duration,
      previewUrl: song.getAudioUrl(),
      imageUrl: song.imageUrl,
      playCount: song.playCount,
      likeCount: song.likeCount,
      popularity: song.popularity,
      explicit: song.explicit,
      releaseDate: song.releaseDate,
    };

    // Check if user liked the song
    let isLiked = false;
    if (req.user) {
      isLiked = !!(await UserLikes.isLikedByUser(req.user._id, song._id));
    }

    // Cache the song metadata
    await cacheService.cacheSongMetadata(songId, songData);

    res.json({ ...songData, isLiked });
  } catch (error) {
    console.error('Get song error:', error.message);
    res.status(500).json({
      message: 'Failed to get song',
      error: error.message
    });
  }
});

// Get album track with caching
router.get('/albums/:id/track', optionalAuth, async (req, res) => {
  try {
    const albumId = req.params.id;

    // Check cache first
    const cacheKey = `album_track:${albumId}`;
    const cachedTrack = await cacheService.get(cacheKey);
    if (cachedTrack) {
      console.log('Returning cached album track');
      return res.json(cachedTrack);
    }

    const accessToken = await getAccessToken();

    console.log(`Fetching track for album ID: ${albumId}`);

    const response = await fetch(
      `https://api.spotify.com/v1/albums/${albumId}/tracks?market=IN&limit=1`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Spotify API error:', errorData);
      throw new Error(
        `HTTP error! Status: ${response.status}, Message: ${errorData.error?.message || 'Unknown error'}`
      );
    }

    const data = await response.json();
    if (!data.items || !data.items.length) {
      console.warn(`No tracks found for album ID: ${albumId}`);
      return res.status(404).json({ message: 'No tracks found for this album' });
    }

    const track = data.items[0];

    // Get album info for the track
    const albumResponse = await fetch(
      `https://api.spotify.com/v1/albums/${albumId}?market=IN`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    let albumInfo = null;
    if (albumResponse.ok) {
      albumInfo = await albumResponse.json();
    }

    const trackData = {
      spotifyId: track.id,
      title: track.name,
      artist: track.artists?.map((artist) => artist.name).join(', ') || 'Unknown Artist',
      album: albumInfo?.name || 'Unknown Album',
      duration: track.duration_ms || 0,
      releaseDate: albumInfo?.release_date ? new Date(albumInfo.release_date) : null,
      previewUrl: track.preview_url || null,
      imageUrl: albumInfo?.images[0]?.url || null,
      popularity: track.popularity || 0,
      explicit: track.explicit || false,
    };

    console.log('Track data to save:', trackData);

    try {
      const savedTrack = await Song.findOneAndUpdate(
        { spotifyId: trackData.spotifyId },
        trackData,
        { upsert: true, new: true }
      );
      console.log('Saved track:', savedTrack);

      // Use Cloudinary URL if available
      trackData.previewUrl = savedTrack.getAudioUrl();
    } catch (dbError) {
      console.error('Database save error:', dbError.message);
    }

    // Cache the result
    await cacheService.set(cacheKey, trackData, 60 * 60); // 1 hour

    res.json(trackData);
  } catch (error) {
    console.error(`Error fetching album track for ID ${req.params.id}:`, error.message);
    res.status(500).json({
      message: 'Failed to fetch album track',
      error: error.message
    });
  }
});

// Get popular songs
router.get('/popular', optionalAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    // Check cache first
    const cachedSongs = await cacheService.getPopularSongs();
    if (cachedSongs && cachedSongs.length > 0) {
      console.log('Returning cached popular songs');
      return res.json(cachedSongs.slice(0, limit));
    }

    const popularSongs = await Song.findPopular(limit);

    const songs = popularSongs.map(song => ({
      spotifyId: song.spotifyId,
      title: song.title,
      artist: song.artist,
      album: song.album,
      duration: song.duration,
      previewUrl: song.getAudioUrl(),
      imageUrl: song.imageUrl,
      playCount: song.playCount,
      likeCount: song.likeCount,
      popularity: song.popularity,
    }));

    // Cache the results
    await cacheService.cachePopularSongs(songs, 60 * 60); // 1 hour

    res.json(songs);
  } catch (error) {
    console.error('Get popular songs error:', error.message);
    res.status(500).json({
      message: 'Failed to get popular songs',
      error: error.message
    });
  }
});

export default router;