import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Search,
  X,
  Music,
  ChevronDown,
  Bell,
  User,
  Settings,
  LogOut,
  Crown,
  Loader2,
  AlertCircle,
  Clock,
  Play,
  TrendingUp
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { useMusic } from '../../contexts/MusicContext';
import ApiService from '../../services/api';
import './Header.css';

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user, logout } = useAuth();
  const { notifications, markAsRead, markAllAsRead, clearAll } = useNotifications();
  const { playTrack } = useMusic();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const searchRef = useRef(null);
  const userMenuRef = useRef(null);
  const notificationRef = useRef(null);
  const debounceRef = useRef(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowResults(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle search with proper debouncing
  useEffect(() => {
    console.log('🔍 Search query changed:', searchQuery);
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (searchQuery.trim().length >= 2) {
      setSearchLoading(true);
      setSearchError(false);

      debounceRef.current = setTimeout(async () => {
        try {
          console.log('🎯 Executing search for:', searchQuery.trim());
          const response = await ApiService.searchMusic(searchQuery.trim(), 8);
          console.log('📊 Search response:', response);
          setSearchResults(response.songs || []);
          setShowResults(true);
          setSearchError(false);
        } catch (error) {
          console.error('❌ Search error:', error);
          setSearchError(true);
          setSearchResults([]);
        } finally {
          setSearchLoading(false);
        }
      }, 500); // Increased debounce time
    } else {
      setSearchResults([]);
      setShowResults(false);
      setSearchLoading(false);
      setSearchError(false);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchQuery]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      console.log('🔍 Header search submit:', searchQuery.trim());
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setShowResults(false);
      setSearchQuery(''); // Clear search input after navigation
    }
  };

  const handleResultClick = async (track) => {
    console.log('🎵 Search result clicked:', track.title);
    setShowResults(false);
    setSearchQuery('');

    if (track.canPlay) {
      try {
        await playTrack(track);
      } catch (error) {
        console.error('Failed to play track from search:', error);
      }
    } else {
      navigate(`/search?q=${encodeURIComponent(track.title)}`);
    }
  };

  const clearSearch = () => {
    console.log('🧹 Clearing search');
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
    setSearchError(false);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
    setShowUserMenu(false);
  };

  const handleNotificationClick = (notification) => {
    markAsRead(notification.id);
    setShowNotifications(false);

    // Navigate based on notification type
    if (notification.type === 'song_added' && notification.data?.songId) {
      navigate(`/search?q=${encodeURIComponent(notification.data.songId)}`);
    } else if (notification.type === 'playlist_created' && notification.data?.playlistId) {
      navigate(`/playlist/${notification.data.playlistId}`);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;

    return date.toLocaleDateString();
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'song_added':
        return <Music size={16} />;
      case 'playlist_created':
        return <Play size={16} />;
      case 'song_liked':
        return <TrendingUp size={16} />;
      default:
        return <Bell size={16} />;
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <header className="header">
      {/* Logo */}
      <div className="header-left">
        <div className="logo" onClick={() => navigate('/')}>
          <div className="logo-icon">
            <Music size={20} />
          </div>
          <span className="logo-text">Listeners</span>
        </div>
      </div>

      {/* Search */}
      <div className="header-center">
        <div className="search-container" ref={searchRef}>
          <form onSubmit={handleSearchSubmit} className="search-form">
            <div className={`search-input-wrapper ${searchError ? 'error' : ''}`}>
              <Search className="search-icon" size={16} />
              <input
                type="text"
                placeholder="What do you want to listen to?"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
                autoComplete="off"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="clear-search"
                  onClick={clearSearch}
                >
                  <X size={14} />
                </button>
              )}
              <div className="search-status">
                {searchLoading && (
                  <Loader2 className="search-loading" size={16} />
                )}
                {searchError && (
                  <AlertCircle className="search-error" size={16} />
                )}
              </div>
            </div>
          </form>

          {/* Search Results Dropdown */}
          {showResults && searchResults.length > 0 && (
            <div className="search-results">
              <div className="results-header">
                <span>Search Results</span>
                <button onClick={() => navigate(`/search?q=${encodeURIComponent(searchQuery)}`)}>
                  View all
                </button>
              </div>
              <div className="results-list">
                {searchResults.map((track) => (
                  <div
                    key={track.spotifyId}
                    className="result-item"
                    onClick={() => handleResultClick(track)}
                  >
                    <div className="result-image">
                      <img
                        src={track.imageUrl || 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=60'}
                        alt={track.title}
                        onError={(e) => {
                          e.target.src = 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=60';
                        }}
                      />
                    </div>
                    <div className="result-info">
                      <div className="result-title">{track.title}</div>
                      <div className="result-artist">{track.artist}</div>
                      {track.isInDatabase && (
                        <div className="result-badge">Available</div>
                      )}
                    </div>
                    <div className="result-duration">
                      {track.duration ? Math.floor(track.duration / 60000) + ':' +
                        Math.floor((track.duration % 60000) / 1000).toString().padStart(2, '0') : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User Section */}
      <div className="header-right">
        <div className="user-section">
          {/* Notifications */}
          {isAuthenticated && (
            <div className="notification-container" ref={notificationRef}>
              <button
                className="notification-btn"
                onClick={() => setShowNotifications(!showNotifications)}
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="notification-badge">{unreadCount}</span>
                )}
              </button>

              {showNotifications && (
                <div className="notification-dropdown">
                  <div className="notification-header">
                    <h3>Notifications</h3>
                    {notifications.length > 0 && (
                      <button className="clear-all-btn" onClick={clearAll}>
                        Clear all
                      </button>
                    )}
                  </div>

                  <div className="notification-list">
                    {notifications.length > 0 ? (
                      notifications.slice(0, 10).map((notification) => (
                        <div
                          key={notification.id}
                          className={`notification-item ${!notification.read ? 'unread' : ''}`}
                          onClick={() => handleNotificationClick(notification)}
                        >
                          <div className="notification-icon">
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="notification-content">
                            <div className="notification-title">{notification.title}</div>
                            <div className="notification-message">{notification.message}</div>
                            <div className="notification-time">
                              <Clock size={12} />
                              {formatTime(notification.createdAt)}
                            </div>
                          </div>
                          {!notification.read && <div className="unread-indicator" />}
                        </div>
                      ))
                    ) : (
                      <div className="empty-notifications">
                        <Bell size={48} />
                        <p>No notifications yet</p>
                        <span>We'll notify you when something happens</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* User Menu */}
          {isAuthenticated ? (
            <div className="user-menu-container" ref={userMenuRef}>
              <button
                className="user-button"
                onClick={() => setShowUserMenu(!showUserMenu)}
              >
                <div className="user-avatar">
                  {user?.avatar ? (
                    <img src={user.avatar} alt={user.username} />
                  ) : (
                    <User size={16} />
                  )}
                </div>
                <span className="username">{user?.username}</span>
                <ChevronDown
                  className={`chevron ${showUserMenu ? 'rotated' : ''}`}
                  size={16}
                />
              </button>

              {showUserMenu && (
                <div className="user-dropdown">
                  <div className="dropdown-header">
                    <div className="user-avatar-large">
                      {user?.avatar ? (
                        <img src={user.avatar} alt={user.username} />
                      ) : (
                        <User size={24} />
                      )}
                    </div>
                    <div className="user-details">
                      <div className="user-name">{user?.firstName || user?.username}</div>
                      <div className="user-email">{user?.email}</div>
                      <div className={`subscription-badge ${user?.subscription?.type || 'free'}`}>
                        {user?.subscription?.type === 'premium' ? (
                          <>
                            <Crown size={12} />
                            Premium
                          </>
                        ) : (
                          'Free'
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="dropdown-menu">
                    <button
                      className="dropdown-item"
                      onClick={() => {
                        navigate('/profile');
                        setShowUserMenu(false);
                      }}
                    >
                      <User size={16} />
                      Profile
                    </button>
                    <button
                      className="dropdown-item"
                      onClick={() => {
                        navigate('/dashboard');
                        setShowUserMenu(false);
                      }}
                    >
                      <Settings size={16} />
                      Dashboard
                    </button>
                    {user?.subscription?.type !== 'premium' && (
                      <button
                        className="dropdown-item premium"
                        onClick={() => {
                          setShowUserMenu(false);
                        }}
                      >
                        <Crown size={16} />
                        Upgrade to Premium
                      </button>
                    )}
                    <div className="dropdown-divider" />
                    <button
                      className="dropdown-item logout"
                      onClick={handleLogout}
                    >
                      <LogOut size={16} />
                      Log out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="auth-buttons">
              <button
                className="auth-btn login-btn"
                onClick={() => navigate('/signin')}
              >
                Log in
              </button>
              <button
                className="auth-btn signup-btn"
                onClick={() => navigate('/signup')}
              >
                Sign up
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;