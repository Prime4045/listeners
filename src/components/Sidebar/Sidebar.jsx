import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home,
  Search,
  Library,
  Plus,
  Heart,
  Music,
  User,
  TrendingUp,
  Clock,
  Download,
  Radio,
  Mic2,
  Globe,
  Users,
  Lock
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import CreatePlaylistModal from '../CreatePlaylistModal/CreatePlaylistModal';
import ApiService from '../../services/api';
import './Sidebar.css';

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  const [playlists, setPlaylists] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      loadPlaylists();
    }
  }, [isAuthenticated]);

  // Listen for playlist updates
  useEffect(() => {
    const handlePlaylistUpdate = () => {
      if (isAuthenticated) {
        loadPlaylists();
      }
    };

    window.addEventListener('playlist_created', handlePlaylistUpdate);
    return () => window.removeEventListener('playlist_created', handlePlaylistUpdate);
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

  const handlePlaylistCreated = (playlist) => {
    setPlaylists(prev => [playlist, ...prev]);
    setShowCreateModal(false);

    // Dispatch events
    window.dispatchEvent(new CustomEvent('playlist_created'));
  };

  const getPlaylistIcon = (playlist) => {
    if (playlist.isPublic) return <Globe size={16} />;
    if (playlist.isCollaborative) return <Users size={16} />;
    return <Music size={16} />;
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

  const isActive = (path) => location.pathname === path;

  const mainNavItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/search', icon: Search, label: 'Search' },
    { path: '/library', icon: Library, label: 'Your Library' },
  ];

  const libraryItems = isAuthenticated ? [
    { path: '/liked', icon: Heart, label: 'Liked Songs', gradient: true },
    { path: '/downloaded', icon: Download, label: 'Downloaded' },
    { path: '/recently-played', icon: Clock, label: 'Recently Played' },
  ] : [];

  return (
    <aside className="sidebar">
      {/* Main Navigation */}
      <nav className="main-nav">
        <ul className="nav-list">
          {mainNavItems.map((item) => (
            <li key={item.path}>
              <button
                className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                onClick={() => navigate(item.path)}
              >
                <item.icon size={20} />
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Library Section */}
      {isAuthenticated && (
        <div className="library-section">
          <div className="library-nav">
            {libraryItems.map((item) => (
              <button
                key={item.path}
                className={`library-item ${isActive(item.path) ? 'active' : ''}`}
                onClick={() => navigate(item.path)}
              >
                <div className={`library-icon ${item.gradient ? 'gradient' : ''}`}>
                  <item.icon size={16} />
                </div>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Playlists Section */}
      <div className="playlists-section">
        {isAuthenticated ? (
          <>
            <div className="playlists-header">
              <span>Recently Created</span>
              <button
                className="view-all-btn"
                onClick={() => navigate('/library')}
              >
                Show all
              </button>
            </div>

            <div className="playlists-container">
              {loading ? (
                <div className="playlists-loading">
                  <div className="loading-spinner"></div>
                  <span>Loading playlists...</span>
                </div>
              ) : playlists.length > 0 ? (
                <div className="playlists-list">
                  {playlists.slice(0, 8).map((playlist, index) => (
                    <button
                      key={playlist._id}
                      className="playlist-item"
                      onClick={() => navigate(`/playlist/${playlist._id}`)}
                    >
                      <div
                        className="playlist-cover"
                        style={{ background: getPlaylistGradient(index) }}
                      >
                        <Music size={16} />
                      </div>
                      <div className="slideBar-playlist-info">
                        <div className="playlist-name">{playlist.name}</div>
                        <div className="playlist-meta">
                          {getPlaylistIcon(playlist)}
                          <span>{playlist.songs?.length || 0} songs</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty-playlists">
                  <Music size={32} />
                  <p>Create your first playlist</p>
                  <button
                    className="create-first-playlist"
                    onClick={() => setShowCreateModal(true)}
                  >
                    <Plus size={16} />
                    Create Playlist
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="auth-prompt">
            <div className="auth-prompt-content">
              <Music size={48} />
              <h4>Create your first playlist</h4>
              <p>Log in to create playlists and save your favorite music</p>
              <button
                className="auth-prompt-btn"
                onClick={() => navigate('/signin')}
              >
                Log in
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
    </aside>
  );
};

export default Sidebar;