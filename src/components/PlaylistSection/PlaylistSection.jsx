import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Music, 
  Play, 
  Lock, 
  Heart, 
  Clock, 
  Users, 
  Globe, 
  MoreHorizontal,
  Shuffle,
  TrendingUp,
  Star,
  Headphones
} from 'lucide-react';
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
  const [hoveredPlaylist, setHoveredPlaylist] = useState(null);

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

  const getPlaylistIcon = (playlist) => {
    if (playlist.isPublic) return <Globe size={12} />;
    if (playlist.isCollaborative) return <Users size={12} />;
    return <Music size={12} />;
  };

  const getPlaylistGradient = (index) => {
    const gradients = [
      'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
      'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
      'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
    ];
    return gradients[index % gradients.length];
  };

  if (!isAuthenticated) {
    return (
      <div className="playlist-section">
        <div className="section-header">
          <div className="header-content">
            <h3 className="section-title">Your Library</h3>
            <div className="header-actions">
              <button 
                className="create-btn premium"
                onClick={onAuthRequired}
                title="Sign in to create playlists"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
        </div>
        
        <div className="guest-state">
          <div className="guest-content">
            <div className="guest-icon">
              <Lock size={32} />
            </div>
            <div className="guest-text">
              <h4>Create your first playlist</h4>
              <p>It's easy, we'll help you</p>
            </div>
            <button 
              className="auth-cta-btn"
              onClick={onAuthRequired}
            >
              Create playlist
            </button>
          </div>
          
          <div className="guest-features">
            <div className="feature-item">
              <Heart size={16} />
              <span>Like your favorite songs</span>
            </div>
            <div className="feature-item">
              <Headphones size={16} />
              <span>Listen anywhere</span>
            </div>
            <div className="feature-item">
              <Star size={16} />
              <span>Discover new music</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="playlist-section">
      <div className="section-header">
        <div className="header-content">
          <h3 className="section-title">Your Library</h3>
          <div className="header-actions">
            <button 
              className="create-btn premium"
              onClick={handleCreatePlaylist}
              title="Create new playlist"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
        <div className="library-stats">
          <span className="stat-item">
            <Music size={14} />
            {playlists.length} playlists
          </span>
        </div>
      </div>

      <div className="playlist-container">
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading your music...</p>
          </div>
        ) : playlists.length > 0 ? (
          <div className="playlist-grid">
            {playlists.map((playlist, index) => (
              <div 
                key={playlist._id} 
                className="playlist-card"
                onClick={() => handlePlaylistClick(playlist)}
                onMouseEnter={() => setHoveredPlaylist(playlist._id)}
                onMouseLeave={() => setHoveredPlaylist(null)}
              >
                <div 
                  className="playlist-cover"
                  style={{ background: getPlaylistGradient(index) }}
                >
                  <div className="cover-content">
                    <Music size={24} />
                  </div>
                  <div className="cover-overlay">
                    <button 
                      className="play-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        // TODO: Implement playlist play functionality
                      }}
                      style={{
                        opacity: hoveredPlaylist === playlist._id ? 1 : 0,
                        transform: hoveredPlaylist === playlist._id ? 'translateY(0)' : 'translateY(8px)'
                      }}
                    >
                      <Play size={16} />
                    </button>
                  </div>
                </div>
                
                <div className="playlist-info">
                  <div className="playlist-header">
                    <h4 className="playlist-name">{playlist.name}</h4>
                    <button className="playlist-menu">
                      <MoreHorizontal size={16} />
                    </button>
                  </div>
                  
                  <div className="playlist-meta">
                    <div className="meta-item">
                      {getPlaylistIcon(playlist)}
                      <span>{playlist.songs?.length || 0} songs</span>
                    </div>
                    {playlist.playCount > 0 && (
                      <div className="meta-item">
                        <TrendingUp size={12} />
                        <span>{playlist.playCount} plays</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="playlist-actions">
                    <button className="action-btn" title="Shuffle play">
                      <Shuffle size={14} />
                    </button>
                    <button className="action-btn" title="Add to favorites">
                      <Heart size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            
            {/* Create New Playlist Card */}
            <div 
              className="playlist-card create-card"
              onClick={handleCreatePlaylist}
            >
              <div className="playlist-cover create-cover">
                <div className="cover-content">
                  <Plus size={32} />
                </div>
              </div>
              <div className="playlist-info">
                <h4 className="playlist-name">Create playlist</h4>
                <p className="create-description">Make your own mix</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-content">
              <div className="empty-icon">
                <Music size={48} />
              </div>
              <h4>Create your first playlist</h4>
              <p>It's easy, we'll help you</p>
              <button 
                className="create-first-btn"
                onClick={handleCreatePlaylist}
              >
                Create playlist
              </button>
            </div>
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