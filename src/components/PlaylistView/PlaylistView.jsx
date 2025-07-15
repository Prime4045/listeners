import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Play, 
  Pause, 
  Shuffle, 
  Heart, 
  Download, 
  MoreHorizontal,
  Clock,
  Search,
  SortDesc,
  Loader2,
  Music
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useMusic } from '../../contexts/MusicContext';
import TrackList from '../TrackList';
import ApiService from '../../services/api';
import './PlaylistView.css';

const PlaylistView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { currentTrack, isPlaying, playTrack, playlist } = useMusic();
  
  const [playlistData, setPlaylistData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPlaylistPlaying, setIsPlaylistPlaying] = useState(false);

  useEffect(() => {
    if (id && isAuthenticated) {
      loadPlaylist();
    } else if (!isAuthenticated) {
      navigate('/signin');
    }
  }, [id, isAuthenticated, navigate]);

  useEffect(() => {
    // Check if current track is from this playlist
    if (playlistData && currentTrack) {
      const isFromThisPlaylist = playlistData.songs?.some(
        item => item.song?.spotifyId === currentTrack.spotifyId
      );
      setIsPlaylistPlaying(isFromThisPlaylist && isPlaying);
    }
  }, [currentTrack, isPlaying, playlistData]);

  const loadPlaylist = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await ApiService.getPlaylist(id);
      setPlaylistData(response);
    } catch (err) {
      console.error('Failed to load playlist:', err);
      setError('Failed to load playlist');
    } finally {
      setLoading(false);
    }
  };

  const handlePlayPlaylist = async () => {
    if (!playlistData?.songs?.length) return;

    const playableSongs = playlistData.songs
      .filter(item => item.song && item.song.isActive !== false)
      .map(item => ({
        ...item.song,
        canPlay: true
      }));

    if (playableSongs.length === 0) return;

    try {
      // If playlist is currently playing, pause it
      if (isPlaylistPlaying) {
        // This would pause the current track
        return;
      }

      // Play first song in playlist
      await playTrack(playableSongs[0], playableSongs);
    } catch (error) {
      console.error('Failed to play playlist:', error);
    }
  };

  const formatDuration = (ms) => {
    if (!ms) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getTotalDuration = () => {
    if (!playlistData?.songs) return '0 min';
    
    const totalMs = playlistData.songs.reduce((total, item) => {
      return total + (item.song?.duration || 0);
    }, 0);
    
    const totalMinutes = Math.floor(totalMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours > 0) {
      return `${hours} hr ${minutes} min`;
    }
    return `${minutes} min`;
  };

  const getPlaylistImage = () => {
    // Get the first song with an image, or use a default playlist image
    const firstSongWithImage = playlistData?.songs?.find(item => item.song?.imageUrl);
    if (firstSongWithImage?.song?.imageUrl) {
      return firstSongWithImage.song.imageUrl;
    }
    
    // Default playlist cover with gradient
    return 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=300';
  };

  const formatTracks = (songs) => {
    return songs
      .filter(item => item.song)
      .map(item => ({
        ...item.song,
        addedAt: item.addedAt,
        canPlay: item.song.isActive !== false
      }));
  };

  if (loading) {
    return (
      <div className="playlist-view">
        <div className="playlist-loading">
          <Loader2 className="animate-spin" size={48} />
          <p>Loading playlist...</p>
        </div>
      </div>
    );
  }

  if (error || !playlistData) {
    return (
      <div className="playlist-view">
        <div className="playlist-error">
          <Music size={48} />
          <h2>Playlist not found</h2>
          <p>{error || 'The playlist you\'re looking for doesn\'t exist or you don\'t have access to it.'}</p>
          <button onClick={() => navigate('/')} className="back-home-btn">
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const tracks = formatTracks(playlistData.songs || []);

  return (
    <div className="playlist-view">
      {/* Header */}
      <div className="playlist-header">
        <button className="back-btn" onClick={() => navigate('/')}>
          <ArrowLeft size={24} />
        </button>
        
        <div className="playlist-info">
          <div className="playlist-cover">
            <img
              src={getPlaylistImage()}
              alt={playlistData.name}
              onError={(e) => {
                e.target.src = 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=300';
              }}
            />
          </div>
          
          <div className="playlist-details">
            <span className="playlist-type">{playlistData.isPublic ? 'Public Playlist' : 'Playlist'}</span>
            <h1 className="playlist-title">{playlistData.name}</h1>
            <div className="playlist-meta">
              {playlistData.description && (
                <>
                  <span className="playlist-description">{playlistData.description}</span>
                  <span className="separator">•</span>
                </>
              )}
              <span className="playlist-owner">
                {playlistData.owner?.username || 'Unknown'}
              </span>
              <span className="separator">•</span>
              <span className="playlist-stats">
                {playlistData.songs?.length || 0} songs{playlistData.songs?.length > 0 && `, ${getTotalDuration()}`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="playlist-controls">
        <button 
          className="play-btn-large"
          onClick={handlePlayPlaylist}
          disabled={!tracks.length}
        >
          {isPlaylistPlaying ? <Pause size={24} /> : <Play size={24} />}
        </button>
        
        <button className="control-btn">
          <Shuffle size={20} />
        </button>
        
        <button className="control-btn">
          <Heart size={20} />
        </button>
        
        <button className="control-btn">
          <Download size={20} />
        </button>
        
        <button className="control-btn">
          <MoreHorizontal size={20} />
        </button>

        <div className="playlist-actions">
          <button className="search-btn">
            <Search size={16} />
          </button>
          <button className="sort-btn">
            Custom order
            <SortDesc size={16} />
          </button>
        </div>
      </div>

      {/* Track List */}
      <div className="playlist-content">
        {tracks.length > 0 ? (
          <TrackList
            tracks={tracks}
            onAuthRequired={() => navigate('/signin')}
            onLikeSong={async (song) => {
              try {
                await ApiService.likeTrack(song.spotifyId);
              } catch (error) {
                console.error('Failed to like song:', error);
              }
            }}
            onAddToLibrary={async (song) => {
              try {
                await ApiService.addToLibrary(song.spotifyId);
              } catch (error) {
                console.error('Failed to add to library:', error);
              }
            }}
            isAuthenticated={isAuthenticated}
            showAddedDate={true}
          />
        ) : (
          <div className="empty-playlist">
            <Music size={64} />
            <h3>This playlist is empty</h3>
            <p>Add some songs to get started</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlaylistView;