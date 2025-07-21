import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Search, 
  User, 
  Settings, 
  LogOut, 
  Crown, 
  Music, 
  ChevronDown,
  Bell,
  Loader2,
  X
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import ApiService from '../../services/api';
import './Header.css';

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchTimeoutRef = useRef(null);
  const searchRef = useRef(null);
  const userMenuRef = useRef(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSearchResults(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(searchQuery.trim());
      }, 300);
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const performSearch = async (query) => {
    try {
      setIsSearching(true);
      const response = await ApiService.searchMusic(query, 5);
      setSearchResults(response.songs || []);
      setShowSearchResults(true);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setShowSearchResults(false);
    }
  };

  const handleSearchResultClick = (track) => {
    setSearchQuery('');
    setShowSearchResults(false);
    // Navigate to search page with this specific track
    navigate(`/search?q=${encodeURIComponent(track.title)}`);
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

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
  };

  const formatDuration = (ms) => {
    if (!ms) return '0:00';
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <header className="header">
      <div className="header-left">
        <div className="logo" onClick={() => navigate('/')}>
          <div className="logo-icon">
            <Music size={24} />
          </div>
          <span className="logo-text">Listeners</span>
        </div>
      </div>

      <div className="header-center">
        <div className="search-container" ref={searchRef}>
          <form onSubmit={handleSearchSubmit} className="search-form">
            <div className="search-input-wrapper">
              <Search className="search-icon" size={18} />
              <input
                type="text"
                placeholder="Search for songs, artists, albums..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
                onFocus={() => searchResults.length > 0 && setShowSearchResults(true)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="clear-search"
                  onClick={clearSearch}
                >
                  <X size={16} />
                </button>
              )}
              {isSearching && (
                <div className="search-loading">
                  <Loader2 className="animate-spin" size={16} />
                </div>
              )}
            </div>
          </form>

          {/* Search Results Dropdown */}
          {showSearchResults && searchResults.length > 0 && (
            <div className="search-results">
              <div className="results-header">
                <span>Quick Results</span>
                <button onClick={() => handleSearchSubmit({ preventDefault: () => {} })}>
                  View All
                </button>
              </div>
              <div className="results-list">
                {searchResults.map((track) => (
                  <div
                    key={track.spotifyId}
                    className="result-item"
                    onClick={() => handleSearchResultClick(track)}
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
                    </div>
                    <div className="result-duration">
                      {formatDuration(track.duration)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="header-right">
        {isAuthenticated ? (
          <div className="user-section">
            <button className="notification-btn">
              <Bell size={20} />
              <span className="notification-badge">3</span>
            </button>
            
            <div className="user-menu-container" ref={userMenuRef}>
              <button
                className="user-button"
                onClick={() => setShowUserMenu(!showUserMenu)}
              >
                <div className="user-avatar">
                  {user?.avatar ? (
                    <img src={user.avatar} alt={user.username} />
                  ) : (
                    <User size={20} />
                  )}
                </div>
                <span className="username">{user?.username}</span>
                <ChevronDown size={16} className={`chevron ${showUserMenu ? 'rotated' : ''}`} />
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
                      <button className="dropdown-item premium">
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
    </header>
  );
};

export default Header;