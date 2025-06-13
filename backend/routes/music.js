import express from 'express';
import { Buffer } from 'buffer';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import Song from '../models/Song.js';
import User from '../models/User.js';

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
    console.log('Spotify access token obtained:', accessToken);
    return accessToken;
  } catch (error) {
    console.error('Spotify token error:', error.message);
    throw new Error('Failed to obtain Spotify access token');
  }
};

// Fetch trending songs (limit 10)
router.get('/trending-songs', optionalAuth, async (req, res) => {
  try {
    const accessToken = await getAccessToken();
    const playlistId = '2fxEEA6a9CPP5CmIJyaIM8'; // Hot Hits Hindi
    const response = await fetch(
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks?market=IN&limit=10`,
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
        `HTTP error! Status: ${response.status}, Message: ${errorData.error.message || 'Unknown error'}`
      );
    }

    const data = await response.json();
    const tracks = data.items.map((item) => ({
      spotifyId: item.track.id,
      title: item.track.name,
      artist: item.track.artists.map((artist) => artist.name).join(', '),
      album: item.track.album.name,
      duration: item.track.duration_ms,
      previewUrl: item.track.preview_url,
      imageUrl: item.track.album.images[0]?.url || null,
    }));

    for (const track of tracks) {
      await Song.findOneAndUpdate(
        { spotifyId: track.spotifyId },
        track,
        { upsert: true, new: true }
      );
    }

    console.log(`Total Trending Songs Fetched: ${tracks.length}`);
    res.json(tracks);
  } catch (error) {
    console.error('Trending songs error:', error.message);
    res.status(500).json({ message: 'Failed to fetch trending songs', error: error.message });
  }
});

// Fetch Bollywood albums (limit 10)
router.get('/bollywood-albums', optionalAuth, async (req, res) => {
  try {
    const accessToken = await getAccessToken();
    const response = await fetch(
      'https://api.spotify.com/v1/search?q=bollywood&type=album&market=IN&limit=10',
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
        `HTTP error! Status: ${response.status}, Message: ${errorData.error.message || 'Unknown error'}`
      );
    }

    const data = await response.json();
    const albums = data.albums.items.map((album) => ({
      spotifyId: album.id,
      title: album.name,
      artist: album.artists.map((artist) => artist.name).join(', '),
      releaseDate: album.release_date,
      imageUrl: album.images[0]?.url || null,
      totalTracks: album.total_tracks,
      spotifyUrl: album.external_urls.spotify,
    }));

    for (const album of albums) {
      await Song.findOneAndUpdate(
        { spotifyId: album.spotifyId },
        {
          spotifyId: album.spotifyId,
          title: album.title,
          artist: album.artist,
          album: album.title,
          duration: 0,
          previewUrl: null,
          imageUrl: album.imageUrl,
        },
        { upsert: true, new: true }
      );
    }

    console.log(`Total Bollywood Albums Fetched: ${albums.length}`);
    res.json(albums);
  } catch (error) {
    console.error('Bollywood albums error:', error.message);
    res.status(500).json({ message: 'Failed to fetch Bollywood albums', error: error.message });
  }
});

// Fetch first track from an album
router.get('/albums/:id/track', optionalAuth, async (req, res) => {
  try {
    const accessToken = await getAccessToken();
    console.log(`Fetching track for album ID: ${req.params.id}`);
    const response = await fetch(
      `https://api.spotify.com/v1/albums/${req.params.id}/tracks?market=IN&limit=1`,
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
        `HTTP error! Status: ${response.status}, Message: ${errorData.error.message || 'Unknown error'}`
      );
    }

    const data = await response.json();
    if (!data.items || !data.items.length) {
      console.warn(`No tracks found for album ID: ${req.params.id}`);
      return res.status(404).json({ message: 'No tracks found for this album' });
    }

    const track = data.items[0];
    const trackData = {
      spotifyId: track.id,
      title: track.name,
      artist: track.artists?.map((artist) => artist.name).join(', ') || 'Unknown Artist',
      album: track.album?.name || 'Unknown Album',
      duration: track.duration_ms || 0,
      previewUrl: track.preview_url || null,
      imageUrl: track.album?.images[0]?.url || null,
    };

    console.log('Track data to save:', trackData);
    const savedTrack = await Song.findOneAndUpdate(
      { spotifyId: trackData.spotifyId },
      trackData,
      { upsert: true, new: true }
    );
    console.log('Saved track:', savedTrack);

    res.json(trackData);
  } catch (error) {
    console.error(`Error fetching album track for ID ${req.params.id}:`, error.message);
    res.status(500).json({ message: 'Failed to fetch album track', error: error.message });
  }
});

// Search songs
router.get('/search', optionalAuth, async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ message: 'Query parameter is required' });
    }

    const accessToken = await getAccessToken();
    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&market=IN&limit=20`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`HTTP error! Status: ${response.status}, Message: ${errorData.error.message}`);
    }

    const data = await response.json();
    const tracks = data.tracks.items.map((track) => ({
      spotifyId: track.id,
      title: track.name,
      artist: track.artists.map((artist) => artist.name).join(', '),
      album: track.album.name,
      duration: track.duration_ms,
      previewUrl: track.preview_url,
      imageUrl: track.album.images[0]?.url,
    }));

    for (const track of tracks) {
      await Song.findOneAndUpdate(
        { spotifyId: track.spotifyId },
        track,
        { upsert: true, new: true }
      );
    }

    res.json(tracks);
  } catch (error) {
    console.error('Search error:', error.message);
    res.status(500).json({ message: 'Failed to search songs', error: error.message });
  }
});

// Play a song
router.post('/:id/play', authenticateToken, async (req, res) => {
  try {
    const song = await Song.findOne({ spotifyId: req.params.id });
    let songData;

    if (!song) {
      const accessToken = await getAccessToken();
      const response = await fetch(`https://api.spotify.com/v1/tracks/${req.params.id}?market=IN`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`HTTP error! Status: ${response.status}, Message: ${errorData.error.message}`);
      }

      const track = await response.json();
      songData = {
        spotifyId: track.id,
        title: track.name,
        artist: track.artists.map((artist) => artist.name).join(', '),
        album: track.album.name,
        duration: track.duration_ms,
        previewUrl: track.preview_url,
        imageUrl: track.album.images[0]?.url,
      };

      const newSong = new Song(songData);
      await newSong.save();
      songData = newSong;
    } else {
      songData = {
        spotifyId: song.spotifyId,
        title: song.title,
        artist: song.artist,
        album: song.album,
        duration: song.duration,
        previewUrl: song.previewUrl,
        imageUrl: song.imageUrl,
      };
    }

    // Update user's recently played, deduplicate by song ID
    const songId = song?._id || (await Song.findOne({ spotifyId: req.params.id }))._id;
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { recentlyPlayed: { song: songId } },
    });
    await User.findByIdAndUpdate(req.user._id, {
      $push: {
        recentlyPlayed: {
          song: songId,
          playedAt: new Date(),
        },
      },
      $slice: { recentlyPlayed: -5 },
    });

    res.json(songData);
  } catch (error) {
    console.error('Play error:', error.message);
    res.status(500).json({ message: 'Failed to play song', error: error.message });
  }
});

// Get song details
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const song = await Song.findOne({ spotifyId: req.params.id });
    if (!song) {
      const accessToken = await getAccessToken();
      const response = await fetch(`https://api.spotify.com/v1/tracks/${req.params.id}?market=IN`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`HTTP error! Status: ${response.status}, Message: ${errorData.error.message}`);
      }

      const track = await response.json();
      const songData = {
        spotifyId: track.id,
        title: track.name,
        artist: track.artists.map((artist) => artist.name).join(', '),
        album: track.album.name,
        duration: track.duration_ms,
        previewUrl: track.preview_url,
        imageUrl: track.album.images[0]?.url,
      };

      const newSong = new Song(songData);
      await newSong.save();
      res.json(songData);
    } else {
      res.json(song);
    }
  } catch (error) {
    console.error('Get song error:', error.message);
    res.status(500).json({ message: 'Failed to get song', error: error.message });
  }
});

export default router;