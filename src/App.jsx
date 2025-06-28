import { useState, useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom';
import {
  Search,
  Home,
  Library,
  Heart,
  Plus,
  Music,
  User,
  TrendingUp,
  Loader2,
  Settings,
  LogOut,
  Shield,
  AlertCircle,
} from 'lucide-react';
import TrackList from './components/TrackList';
import AuthModal from './components/auth/AuthModal';
import AuthCallback from './components/auth/AuthCallback';
import Dashboard from './components/Dashboard/Dashboard';
import Profile from './components/Profile/Profile';
import MusicPlayer from './components/MusicPlayer/MusicPlayer';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { MusicProvider } from './contexts/MusicContext';
import ErrorBoundary from './components/ErrorBoundary';
import ApiService from './services/api';
import './App.css';

const samplePlaylists = [
  { id: 1, name: 'Chill Vibes', songCount: 24 },
  { id: 2, name: 'Workout Mix', songCount: 18 },
  { id: 3, name: 'Study Focus', songCount: 32 },
  { id: 4, name: 'Road Trip', songCount: 45 },
  { id: 5, name: 'Late Night', songCount: 16 },
];

const AppContent = () => {
  const [currentView, setCurrentView] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [databaseSongs, setDatabaseSongs] = useState([]);
  const [trendingSongs, setTrendingSongs] = useState([]);
  const [likedSongs, setLikedSongs] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [authModal, setAuthModal] = useState({ isOpen: false, mode: 'login' });
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isPlayerMinimized, setIsPlayerMinimized] = useState(false);

  // Search pagination
  const [searchPagination, setSearchPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalResults: 0
  });

  // Database songs pagination
  const [dbPagination, setDbPagination] = useState({
    currentPage: 1,
    hasMore: true
  });

  const location = useLocation();
  const { user, isAuthenticated, logout, loading: authLoading } = useAuth();

  useEffect(() => {
    if (location.state?.error) {
      setError(location.state.error);
    }
  }, [location]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim() && searchQuery.length >= 2) {
        handleSearch(1); // Reset to page 1 for new search
      } else if (searchQuery.trim() === '') {
        setSearchResults([]);
        setSearchPagination({ currentPage: 1, totalPages: 1, totalResults: 0 });
        if (currentView === 'search') {
          setCurrentView('home');
        }
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const loadDatabaseSongs = async (page = 1) => {
    try {
      setIsLoading(true);
      const response = await ApiService.getDatabaseSongs(page, 20);

      if (page === 1) {
        setDatabaseSongs(response.songs || []);
      } else {
        setDatabaseSongs(prev => [...prev, ...(response.songs || [])]);
      }

      setDbPagination({
        currentPage: page,
        hasMore: response.pagination?.hasNext || false
      });
      setError(null);
    } catch (err) {
      console.error('Failed to load database songs:', err);
      setError('Failed to load available songs. Please check your connection.');
      setDatabaseSongs([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTrendingSongs = async () => {
    try {
      const songs = await ApiService.getTrendingSongs(10);
      setTrendingSongs(songs || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch trending songs:', err);
      setError('Failed to load trending songs. Please check your connection.');
      setTrendingSongs([]);
    }
  };

  const loadLikedSongs = async () => {
    if (!isAuthenticated) return;

    try {
      const songs = await ApiService.getLikedSongs();
      setLikedSongs(songs || []);
    } catch (err) {
      console.error('Failed to load liked songs:', err);
    }
  };

  const handleSearch = async (page = 1) => {
    if (!searchQuery.trim() || searchQuery.length < 2) return;

    try {
      setIsSearching(true);
      setError(null);

      const limit = 20;
      const offset = (page - 1) * limit;
      const results = await ApiService.searchMusic(searchQuery.trim(), limit, offset);

      console.log('Search results:', {
        query: searchQuery,
        page,
        total: results.songs?.length,
        totalResults: results.total
      });

      if (page === 1) {
        setSearchResults(results.songs || []);
      } else {
        setSearchResults(prev => [...prev, ...(results.songs || [])]);
      }

      setSearchPagination({
        currentPage: page,
        totalPages: Math.ceil((results.total || 0) / limit),
        totalResults: results.total || 0
      });

      setCurrentView('search');
    } catch (error) {
      console.error('Search failed:', error);
      setError(`Search failed: ${error.message || 'Unable to fetch songs from Spotify'}. Please try again.`);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchPageChange = (page) => {
    handleSearch(page);
  };

  const handleSearchInputChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    if (value.trim() && currentView !== 'search') {
      setCurrentView('search');
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      handleSearch(1);
    }
  };

  const handleAuthRequired = () => {
    setAuthModal({ isOpen: true, mode: 'login' });
  };

  useEffect(() => {
    if (currentView === 'home') {
      loadDatabaseSongs();
      fetchTrendingSongs();
    } else if (currentView === 'liked' && isAuthenticated) {
      loadLikedSongs();
    }
  }, [currentView, isAuthenticated]);

  useEffect(() => {
    if (user?.preferences?.theme) {
      document.body.classList.toggle('dark', user.preferences.theme === 'dark');
      document.body.classList.toggle('light', user.preferences.theme === 'light');
    }
  }, [user?.preferences?.theme]);

  const openAuthModal = (mode = 'login') => {
    setAuthModal({ isOpen: true, mode });
  };

  const closeAuthModal = () => {
    setAuthModal({ isOpen: false, mode: 'login' });
  };

  const handleUserMenuClick = () => {
    setShowUserMenu(!showUserMenu);
  };

  const handleLogout = async () => {
    try {
      await logout();
      setShowUserMenu(false);
      setCurrentView('home');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showUserMenu && !event.target.closest('.user-menu-container')) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserMenu]);

  const renderMainContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'profile':
        return <Profile />;
      case 'search':
        return (
          <div className="library-view">
            <div className="section-header">
              <Search className="section-icon" />
              <h2>
                {isSearching ? 'Searching...' : searchQuery ? `Results for "${searchQuery}"` : 'Search Music'}
              </h2>
              {searchPagination.totalResults > 0 && (
                <span className="results-count">
                  {searchPagination.totalResults} results found
                </span>
              )}
            </div>

            {error && (
              <div className="error-message">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <TrackList
              tracks={searchResults}
              onAuthRequired={handleAuthRequired}
              showPagination={true}
              currentPage={searchPagination.currentPage}
              totalPages={searchPagination.totalPages}
              onPageChange={handleSearchPageChange}
              isLoading={isSearching}
              searchQuery={searchQuery}
            />

            {!isSearching && searchQuery && searchResults.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                <Music size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                <p>No results found for "{searchQuery}"</p>
                <p>Try searching with different keywords</p>
              </div>
            )}

            {!searchQuery && (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                <Search size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                <p>Start typing to search for songs, artists, or albums</p>
              </div>
            )}
          </div>
        );
      case 'library':
        return (
          <div className="library-view">
            <div className="section-header">
              <Library className="section-icon" />
              <h2>Music Library</h2>
            </div>
            <TrackList
              tracks={databaseSongs}
              onAuthRequired={handleAuthRequired}
              isLoading={isLoading}
            />
            {dbPagination.hasMore && (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <button
                  onClick={() => loadDatabaseSongs(dbPagination.currentPage + 1)}
                  disabled={isLoading}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'var(--accent-purple)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                >
                  {isLoading ? 'Loading...' : 'Load More Songs'}
                </button>
              </div>
            )}
          </div>
        );
      case 'liked':
        return (
          <div className="library-view">
            <div className="section-header">
              <Heart className="section-icon" />
              <h2>Liked Songs</h2>
            </div>
            {isAuthenticated ? (
              <TrackList
                tracks={likedSongs}
                onAuthRequired={handleAuthRequired}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                <Heart size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                <p>Sign in to see your liked songs</p>
                <button
                  onClick={() => openAuthModal('login')}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'var(--accent-purple)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    marginTop: '1rem',
                  }}
                >
                  Sign In
                </button>
              </div>
            )}
          </div>
        );
      default:
        return (
          <>
            <div className="welcome-section">
              <h1>Good evening, {user?.username || 'Guest'}</h1>
              <p>Discover new music and enjoy your favorites</p>
            </div>

            {error && (
              <div className="error-message">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            {isLoading && (
              <div className="loading-indicator">
                <Loader2 className="animate-spin" size={20} />
                <span>Loading music...</span>
              </div>
            )}

            <div className="music-section">
              <div className="section-header">
                <TrendingUp className="section-icon" />
                <h2>Trending Songs</h2>
              </div>
              <div className="music-grid">
                {trendingSongs.length ? (
                  trendingSongs.slice(0, 8).map((track) => (
                    <div
                      key={track.spotifyId}
                      className="music-card"
                    >
                      <div className="card-image">
                        <img
                          src={track.imageUrl || 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=300'}
                          alt={track.title}
                          onError={(e) => {
                            e.target.src = 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=300';
                          }}
                        />
                      </div>
                      <h3>{track.title}</h3>
                      <p>{track.artist}</p>
                      <small style={{ color: 'var(--text-muted)' }}>
                        {track.playCount} plays
                      </small>
                    </div>
                  ))
                ) : (
                  <p>No trending songs available.</p>
                )}
              </div>
            </div>

            <div className="music-section">
              <div className="section-header">
                <Music className="section-icon" />
                <h2>Available Songs</h2>
              </div>
              <div className="music-grid">
                {databaseSongs.length ? (
                  databaseSongs.slice(0, 8).map((track) => (
                    <div
                      key={track.spotifyId}
                      className="music-card"
                    >
                      <div className="card-image">
                        <img
                          src={track.imageUrl || 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=300'}
                          alt={track.title}
                          onError={(e) => {
                            e.target.src = 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=300';
                          }}
                        />
                      </div>
                      <h3>{track.title}</h3>
                      <p>{track.artist}</p>
                      <small style={{ color: 'var(--text-muted)' }}>
                        {track.playCount} plays
                      </small>
                    </div>
                  ))
                ) : (
                  <p>No songs available in database.</p>
                )}
              </div>
            </div>
          </>
        );
    }
  };

  if (authLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <Music size={48} className="loading-icon" />
          <Loader2 className="animate-spin" size={24} />
          <p>Loading Listeners...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="app-container">
        <header className="header">
          <div className="header-left">
            <div className="logo">
              <div className="logo-icon">
                <Music size={20} />
              </div>
              <span className="logo-text">Listeners</span>
            </div>
          </div>

          <div className="header-center">
            <form className="search-bar" onSubmit={handleSearchSubmit}>
              <Search className="search-icon" />
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchInputChange}
                placeholder="Search for songs, artists, albums..."
                className="search-input"
                aria-label="Search for songs, artists, or albums"
              />
              {isSearching && (
                <Loader2
                  className="search-loading"
                  size={18}
                  style={{
                    position: 'absolute',
                    right: '1rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    animation: 'spin 1s linear infinite',
                  }}
                />
              )}
            </form>
          </div>

          <div className="header-right">
            <div className="user-menu-container">
              {isAuthenticated ? (
                <>
                  <div className="user-info" onClick={handleUserMenuClick}>
                    <div className="user-avatar">
                      {user?.profilePicture ? (
                        <img src={user.profilePicture} alt={user.username} />
                      ) : (
                        <User size={20} />
                      )}
                    </div>
                    <span className="username">{user?.username}</span>
                  </div>

                  {showUserMenu && (
                    <div className="user-dropdown">
                      <div className="dropdown-header">
                        <div className="user-avatar-large">
                          {user?.profilePicture ? (
                            <img src={user.profilePicture} alt={user.username} />
                          ) : (
                            <User size={24} />
                          )}
                        </div>
                        <div className="user-details">
                          <div className="user-name">
                            {user?.firstName && user?.lastName
                              ? `${user.firstName} ${user.lastName}`
                              : user?.username}
                          </div>
                          <div className="user-email">{user?.email}</div>
                          <div className="user-subscription">
                            {user?.subscription?.type === 'premium' ? (
                              <span className="premium-badge">Premium</span>
                            ) : (
                              <span className="free-badge">Free</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="dropdown-menu">
                        <button
                          className="dropdown-item"
                          onClick={() => {
                            setCurrentView('dashboard');
                            setShowUserMenu(false);
                          }}
                        >
                          <Home size={16} />
                          <span>Dashboard</span>
                        </button>
                        <button
                          className="dropdown-item"
                          onClick={() => {
                            setCurrentView('profile');
                            setShowUserMenu(false);
                          }}
                        >
                          <User size={16} />
                          <span>Profile</span>
                        </button>
                        <button className="dropdown-item">
                          <Settings size={16} />
                          <span>Settings</span>
                        </button>
                        {user?.mfaEnabled && (
                          <button className="dropdown-item">
                            <Shield size={16} />
                            <span>Security</span>
                          </button>
                        )}
                        <div className="dropdown-divider"></div>
                        <button
                          className="dropdown-item logout"
                          onClick={handleLogout}
                        >
                          <LogOut size={16} />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="auth-buttons">
                  <button
                    className="auth-btn login-btn"
                    onClick={() => openAuthModal('login')}
                  >
                    Sign In
                  </button>
                  <button
                    className="auth-btn register-btn"
                    onClick={() => openAuthModal('register')}
                  >
                    Sign Up
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="main-layout">
          <aside className="sidebar">
            <nav className="nav">
              <h3 className="nav-title">MENU</h3>
              <ul className="nav-list">
                <li
                  className={`nav-item ${currentView === 'home' ? 'active' : ''}`}
                  onClick={() => setCurrentView('home')}
                >
                  <Home className="nav-icon" />
                  <span>Home</span>
                </li>
                {isAuthenticated && (
                  <li
                    className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
                    onClick={() => setCurrentView('dashboard')}
                  >
                    <TrendingUp className="nav-icon" />
                    <span>Dashboard</span>
                  </li>
                )}
                <li
                  className={`nav-item ${currentView === 'library' ? 'active' : ''}`}
                  onClick={() => setCurrentView('library')}
                >
                  <Library className="nav-icon" />
                  <span>Your Library</span>
                </li>
                <li
                  className={`nav-item ${currentView === 'liked' ? 'active' : ''}`}
                  onClick={() => setCurrentView('liked')}
                >
                  <Heart className="nav-icon" />
                  <span>Liked Songs</span>
                </li>
              </ul>
            </nav>
            <div className="playlists">
              <div className="playlists-header">
                <h3 className="nav-title">PLAYLISTS</h3>
                <Plus className="add-playlist" />
              </div>
              <div className="playlist-list">
                {samplePlaylists.map((playlist) => (
                  <div key={playlist.id} className="playlist-item">
                    <div className="playlist-cover"></div>
                    <div className="playlist-info">
                      <div className="playlist-name">{playlist.name}</div>
                      <div className="playlist-count">{playlist.songCount} songs</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <main className="main-content">{renderMainContent()}</main>
        </div>
      </div>

      {/* Music Player */}
      <MusicPlayer
        isMinimized={isPlayerMinimized}
        onToggleMinimize={() => setIsPlayerMinimized(!isPlayerMinimized)}
      />

      <AuthModal
        isOpen={authModal.isOpen}
        onClose={closeAuthModal}
        initialMode={authModal.mode}
      />
    </div>
  );
};

function App() {
  return (
    <Router>
      <ErrorBoundary>
        <AuthProvider>
          <MusicProvider>
            <Routes>
              <Route path="/" element={<AppContent />} />
              <Route path="/login" element={<AppContent />} />
              <Route path="/dashboard" element={<AppContent />} />
              <Route path="/profile" element={<AppContent />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </MusicProvider>
        </AuthProvider>
      </ErrorBoundary>
    </Router>
  );
}

export default App;