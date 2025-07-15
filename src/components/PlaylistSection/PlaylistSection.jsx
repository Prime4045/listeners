import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Music, Play, Lock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import CreatePlaylistModal from '../CreatePlaylistModal/CreatePlaylistModal';
import ApiService from '../../services/api';
import './PlaylistSection.css';

const PlaylistSection = ({ onAuthRequired }) => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      loadPlaylists();
    }
  }, [isAuthenticated]);

  // Listen for playlist creation events
  useEffect(() => {
    const handlePlaylistCreated = () => {
      if (isAuthenticated) {
        loadPlaylists();
      }
    };

    window.addEventListener('playlist_created', handlePlaylistCreated);
    
    return () => {
      window.removeEventListener('playlist_created', handlePlaylistCreated);
    };
  }, [isAuthenticated]);

  const loadPlaylists = async () => {
    try {
      setLoading(true);
      const response = await ApiService.getPlaylists();
      setPlaylists(response.playlists || []);
    } catch (error) {
      console.error('Failed to load playlists:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlaylist = () => {
    if (!isAuthenticated) {
      onAuthRequired?.();
      return;
    }
    setShowCreateModal(true);
  };

  const handlePlaylistCreated = (playlist) => {
    setPlaylists(prev => [playlist, ...prev]);
    setShowCreateModal(false);
  };

  const handlePlaylistClick = (playlist) => {
    navigate(`/playlist/${playlist._id}`);
  };
  if (!isAuthenticated) {
    return (
      <div className="playlist-section">
        <div className="playlist-header">
          <h3 className="playlist-title">PLAYLISTS</h3>
          <button 
            className="add-playlist-btn"
            onClick={onAuthRequired}
            title="Sign in to create playlists"
          >
            <Plus size={16} />
          </button>
        </div>
        <div className="playlist-guest-message">
          <div className="guest-content">
            <Lock size={32} />
            <p>Sign in to create and view your playlists</p>
            <button 
              className="sign-in-btn"
              onClick={onAuthRequired}
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="playlist-section">
      <div className="playlist-header">
        <h3 className="playlist-title">PLAYLISTS</h3>
        <button 
          className="add-playlist-btn"
          onClick={handleCreatePlaylist}
          title="Create new playlist"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="playlist-list">
        {loading ? (
          <div className="playlist-loading">
            <div className="loading-spinner"></div>
            <p>Loading playlists...</p>
          </div>
        ) : playlists.length > 0 ? (
          playlists.map((playlist) => (
            <div 
              key={playlist._id} 
              className="playlist-item"
              onClick={() => handlePlaylistClick(playlist)}
            >
              <div className="playlist-cover">
                <Music size={16} />
              </div>
              <div className="playlist-info">
                <div className="playlist-name">{playlist.name}</div>
                <div className="playlist-count">
                  {playlist.songs?.length || 0} songs
                </div>
              </div>
              <button 
                className="playlist-play-btn" 
                title="Play playlist"
                onClick={(e) => {
                  e.stopPropagation();
                  // TODO: Implement playlist play functionality
                }}
              >
                <Play size={12} />
              </button>
            </div>
          ))
        ) : (
          <div className="empty-playlists">
            <Music size={24} />
            <p>No playlists yet</p>
            <span>Create your first playlist</span>
          </div>
        )}
      </div>

      <CreatePlaylistModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onPlaylistCreated={handlePlaylistCreated}
      />
    </div>
  );
};

export default PlaylistSection;