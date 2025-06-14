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
    console.log('Spotify access token obtained successfully');
    return accessToken;
  } catch (error) {
    console.error('Spotify token error:', error.message);
    throw new Error('Failed to obtain Spotify access token');
  }
};

// Fetch trending songs (limit configurable)
router.get('/trending-songs', optionalAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50); // Max 50 songs
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
      .filter(item => item.track && item.track.id) // Filter out null tracks
      .map((item) => ({
        spotifyId: item.track.id,
        title: item.track.name,
        artist: item.track.artists.map((artist) => artist.name).join(', '),
        album: item.track.album.name,
        duration: item.track.duration_ms,
        previewUrl: item.track.preview_url,
        imageUrl: item.track.album.images[0]?.url || null,
      }));

    // Save tracks to database
    for (const track of tracks) {
      try {
        await Song.findOneAndUpdate(
          { spotifyId: track.spotifyId },
          track,
          { upsert: true, new: true }
        );
      } catch (dbError) {
        console.error('Database save error for track:', track.spotifyId, dbError.message);
      }
    }

    console.log(`Total Trending Songs Fetched: ${tracks.length}`);
    res.json(tracks);
  } catch (error) {
    console.error('Trending songs error:', error.message);
    res.status(500).json({ 
      message: 'Failed to fetch trending songs', 
      error: error.message 
    });
  }
});

// Fetch Bollywood albums (limit configurable)
router.get('/bollywood-albums', optionalAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50); // Max 50 albums
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
      releaseDate: album.release_date,
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
            previewUrl: null,
            imageUrl: album.imageUrl,
          },
          { upsert: true, new: true }
        );
      } catch (dbError) {
        console.error('Database save error for album:', album.spotifyId, dbError.message);
      }
    }

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

// Fetch first track from an album
router.get('/albums/:id/track', optionalAuth, async (req, res) => {
  try {
    const accessToken = await getAccessToken();
    const albumId = req.params.id;
    
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
      previewUrl: track.preview_url || null,
      imageUrl: albumInfo?.images[0]?.url || null,
    };

    console.log('Track data to save:', trackData);
    
    try {
      const savedTrack = await Song.findOneAndUpdate(
        { spotifyId: trackData.spotifyId },
        trackData,
        { upsert: true, new: true }
      );
      console.log('Saved track:', savedTrack);
    } catch (dbError) {
      console.error('Database save error:', dbError.message);
    }

    res.json(trackData);
  } catch (error) {
    console.error(`Error fetching album track for ID ${req.params.id}:`, error.message);
    res.status(500).json({ 
      message: 'Failed to fetch album track', 
      error: error.message 
    });
  }
});

// Enhanced search songs with multiple query types
router.get('/search', optionalAuth, async (req, res) => {
  try {
    const { query, limit = 20 } = req.query;
    
    if (!query || query.trim().length < 2) {
      return res.status(400).json({ 
        message: 'Query parameter is required and must be at least 2 characters long' 
      });
    }

    const searchLimit = Math.min(parseInt(limit) || 20, 50); // Max 50 results
    const accessToken = await getAccessToken();
    
    // Enhanced search query - search for tracks, artists, and albums
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
      previewUrl: track.preview_url,
      imageUrl: track.album.images[0]?.url,
      type: 'track'
    })) || [];

    // Process artists (get their top tracks)
    const artists = data.artists?.items?.slice(0, 3) || []; // Limit to 3 artists
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
            previewUrl: track.preview_url,
            imageUrl: track.album.images[0]?.url,
            type: 'artist_track'
          })) || [];
          
          artistTracks.push(...topTracks);
        }
      } catch (artistError) {
        console.error(`Error fetching top tracks for artist ${artist.id}:`, artistError.message);
      }
    }

    // Process albums (get first track from each)
    const albums = data.albums?.items?.slice(0, 3) || []; // Limit to 3 albums
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
              previewUrl: firstTrack.preview_url,
              imageUrl: album.images[0]?.url,
              type: 'album_track'
            });
          }
        }
      } catch (albumError) {
        console.error(`Error fetching tracks for album ${album.id}:`, albumError.message);
      }
    }

    // Combine all results and remove duplicates
    const allTracks = [...tracks, ...artistTracks, ...albumTracks];
    const uniqueTracks = allTracks.filter((track, index, self) => 
      index === self.findIndex(t => t.spotifyId === track.spotifyId)
    );

    // Sort by relevance (direct track matches first, then artist matches, then album matches)
    const sortedTracks = uniqueTracks.sort((a, b) => {
      const typeOrder = { track: 0, artist_track: 1, album_track: 2 };
      return typeOrder[a.type] - typeOrder[b.type];
    });

    // Save tracks to database
    for (const track of sortedTracks) {
      try {
        await Song.findOneAndUpdate(
          { spotifyId: track.spotifyId },
          {
            spotifyId: track.spotifyId,
            title: track.title,
            artist: track.artist,
            album: track.album,
            duration: track.duration,
            previewUrl: track.previewUrl,
            imageUrl: track.imageUrl,
          },
          { upsert: true, new: true }
        );
      } catch (dbError) {
        console.error('Database save error for search result:', track.spotifyId, dbError.message);
      }
    }

    console.log(`Search results for "${query}": ${sortedTracks.length} tracks found`);
    res.json(sortedTracks.slice(0, searchLimit)); // Ensure we don't exceed the limit
  } catch (error) {
    console.error('Search error:', error.message);
    res.status(500).json({ 
      message: 'Failed to search songs', 
      error: error.message 
    });
  }
});

// Play a song
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
        previewUrl: track.preview_url,
        imageUrl: track.album.images[0]?.url,
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
        previewUrl: song.previewUrl,
        imageUrl: song.imageUrl,
      };
    }

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
            $slice: 5, // Keep only the last 5 tracks
          },
        },
      });
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

// Get song details
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const songId = req.params.id;
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
        previewUrl: track.preview_url,
        imageUrl: track.album.images[0]?.url,
      };

      const newSong = new Song(songData);
      await newSong.save();
      res.json(songData);
    } else {
      res.json({
        spotifyId: song.spotifyId,
        title: song.title,
        artist: song.artist,
        album: song.album,
        duration: song.duration,
        previewUrl: song.previewUrl,
        imageUrl: song.imageUrl,
      });
    }
  } catch (error) {
    console.error('Get song error:', error.message);
    res.status(500).json({ 
      message: 'Failed to get song', 
      error: error.message 
    });
  }
});

export default router;