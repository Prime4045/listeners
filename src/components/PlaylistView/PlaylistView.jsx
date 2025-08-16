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
  Music,
  Share,
  Plus,
  Users,
  Globe,
  Lock,
  Calendar,
  TrendingUp,
  Headphones
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useMusic } from '../../contexts/MusicContext';
import TrackList from '../TrackList';
import ApiService from '../../services/api';
import './PlaylistView.css';

const PlaylistView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { currentTrack, isPlaying, playTrack, playlist } = useMusic();

  const [playlistData, setPlaylistData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPlaylistPlaying, setIsPlaylistPlaying] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
    return null;
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

  const getPlaylistTypeIcon = () => {
    if (playlistData?.isPublic) return <Globe size={16} />;
    if (playlistData?.isCollaborative) return <Users size={16} />;
    return <Lock size={16} />;
  };

  const getPlaylistTypeText = () => {
    if (playlistData?.isPublic) return 'Public Playlist';
    if (playlistData?.isCollaborative) return 'Collaborative Playlist';
    return 'Private Playlist';
  };

  const filteredTracks = formatTracks(playlistData?.songs || []).filter(track =>
    searchQuery === '' ||
    track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    track.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="playlist-view">
        <div className="playlist-loading">
          <div className="loading-content">
            <div className="loading-spinner"></div>
            <h3>Loading playlist...</h3>
            <p>Getting your music ready</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !playlistData) {
    return (
      <div className="playlist-view">
        <div className="playlist-error">
          <div className="error-content">
            <div className="error-icon">
              <Music size={50} />
            </div>
            <h2>Playlist not found</h2>
            <p>{error || 'The playlist you\'re looking for doesn\'t exist or you don\'t have access to it.'}</p>
            <button onClick={() => navigate('/')} className="back-home-btn">
              <ArrowLeft size={16} />
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  const tracks = filteredTracks;
  const playlistImage = getPlaylistImage();

  return (
    <div className="playlist-view">
      {/* Header */}
      <div className="playlist-header">
        <div className="playlist-hero">
          <div className="playlist-artwork">
            {playlistImage ? (
              <img
                src={playlistImage}
                alt={playlistData.name}
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
            ) : null}
            <div
              className="default-artwork"
              style={{ display: playlistImage ? 'none' : 'flex' }}
            >
              <Music size={80} />
            </div>
          </div>

          <div className="playlist-details">
            <div className="playlist-type">
              {getPlaylistTypeIcon()}
              <span>{getPlaylistTypeText()}</span>
            </div>

            <h1 className="playlist-title">{playlistData.name}</h1>

            {playlistData.description && (
              <p className="playlist-description">{playlistData.description}</p>
            )}

            <div className="playlist-metadata">
              <div className="metadata-item">
                <div className="owner-avatar">
                  {playlistData.owner?.avatar ? (
                    <img src={playlistData.owner.avatar} alt={playlistData.owner.username} />
                  ) : (
                    <Users size={16} />
                  )}
                </div>
                <span className="owner-name">{playlistData.owner?.username || 'Unknown'}</span>
              </div>

              <span className="separator">•</span>

              <div className="metadata-item">
                <Music size={14} />
                <span>{playlistData.songs?.length || 0} songs</span>
              </div>

              {playlistData.songs?.length > 0 && (
                <>
                  <span className="separator">•</span>
                  <div className="metadata-item">
                    <Clock size={14} />
                    <span>{getTotalDuration()}</span>
                  </div>
                </>
              )}

              {playlistData.playCount > 0 && (
                <>
                  <span className="separator">•</span>
                  <div className="metadata-item">
                    <TrendingUp size={14} />
                    <span>{playlistData.playCount} plays</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="playlist-controls">
        <div className="primary-controls">
          <button
            className="play-btn-large"
            onClick={handlePlayPlaylist}
            disabled={!tracks.length}
          >
            {isPlaylistPlaying ? <Pause size={28} /> : <Play size={28} />}
          </button>

          <button className="playlist-control-btn shuffle-btn">
            <Shuffle size={20} />
          </button>

          <button
            className={`playlist-control-btn like-btn ${isLiked ? 'liked' : ''}`}
            onClick={() => setIsLiked(!isLiked)}
          >
            <Heart size={20} fill={isLiked ? 'currentColor' : 'none'} />
          </button>

          <button className="playlist-control-btn">
            <Download size={20} />
          </button>

          <button className="playlist-control-btn">
            <Share size={20} />
          </button>

          <button
            className={`playlist-control-btn search-btn ${showSearch ? 'active' : ''}`}
            onClick={() => setShowSearch(!showSearch)}
          >
            <Search size={18} />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="search-section">
          <div className="search-container">
            <Search className="search-icon" size={16} />
            <input
              type="text"
              placeholder="Find in playlist"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
              autoFocus
            />
            {searchQuery && (
              <button
                className="clear-search"
                onClick={() => setSearchQuery('')}
              >
                ×
              </button>
            )}
          </div>
        </div>
      )}

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
            <div className="empty-content">
              <div className="empty-icon">
                <Headphones size={64} />
              </div>
              <h3>This playlist is empty</h3>
              <p>Add some songs to get started</p>
              <button className="add-songs-btn">
                <Plus size={16} />
                Find something to play
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlaylistView;