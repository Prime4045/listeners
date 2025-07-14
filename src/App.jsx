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
import AuthCallback from './components/AuthCallback';
import Dashboard from './components/Dashboard/Dashboard';
import Profile from './components/Profile/Profile';
import MusicPlayer from './components/MusicPlayer/MusicPlayer';
import PlaylistSection from './components/PlaylistSection/PlaylistSection';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { MusicProvider } from './contexts/MusicContext';
import ErrorBoundary from './components/ErrorBoundary';
import ApiService from './services/api';
import './App.css';

const AppContent = () => {
  const [currentView, setCurrentView] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [trendingSongs, setTrendingSongs] = useState([]);
  const [newReleases, setNewReleases] = useState([]);
  const [likedSongs, setLikedSongs] = useState([]);
  const [userLibrary, setUserLibrary] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isPlayerMinimized, setIsPlayerMinimized] = useState(false);

  // Search pagination
  const [searchPagination, setSearchPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalResults: 0
  });

  const location = useLocation();
  const { user, isAuthenticated, logout, loading: authLoading } = useAuth();

  // Debounced search to prevent too many requests
  const [searchTimeout, setSearchTimeout] = useState(null);

  useEffect(() => {
    if (location.state?.error) {
      setError(location.state.error);
    }
  }, [location]);

  useEffect(() => {
    // Clear previous timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Set new timeout for search
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim() && searchQuery.length >= 2) {
        handleSearch(1);
      } else if (searchQuery.trim() === '') {
        setSearchResults([]);
        setSearchPagination({ currentPage: 1, totalPages: 1, totalResults: 0 });
        if (currentView === 'search') {
          setCurrentView('home');
        }
      }
    }, 800); // Increased debounce time from 500ms to 800ms

    setSearchTimeout(timeoutId);

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [searchQuery]);

  const loadHomePageData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Add delay to prevent rapid requests
      await new Promise(resolve => setTimeout(resolve, 100));

      const [trendingResponse, newReleasesResponse] = await Promise.allSettled([
        ApiService.getTrendingSongs(12),
        ApiService.getNewReleases(12)
      ]);

      if (trendingResponse.status === 'fulfilled') {
        setTrendingSongs(trendingResponse.value || []);
      } else {
        console.error('Failed to load trending songs:', trendingResponse.reason);
      }

      if (newReleasesResponse.status === 'fulfilled') {
        setNewReleases(newReleasesResponse.value || []);
      } else {
        console.error('Failed to load new releases:', newReleasesResponse.reason);
        // Fallback to trending songs if new releases fail
        setNewReleases(trendingResponse.value?.slice(0, 8) || []);
      }

      if (trendingResponse.status === 'rejected' && newReleasesResponse.status === 'rejected') {
        setError('Failed to load music data. Please try again later.');
      }
    } catch (err) {
      console.error('Failed to load home page data:', err);
      setError('Failed to load music data. Please try again later.');
    } finally {
      setIsLoading(false);
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

  const loadUserLibrary = async () => {
    if (!isAuthenticated) {
      setUserLibrary([]);
      return;
    }

    try {
      const library = await ApiService.getUserLibrary();
      setUserLibrary(library || []);
    } catch (err) {
      console.error('Failed to load user library:', err);
      setUserLibrary([]);
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
    navigate('/signin');
  };

  const handleLikeSong = async (song) => {
    if (!isAuthenticated) {
      handleAuthRequired();
      return;
    }

    try {
      await ApiService.likeTrack(song.spotifyId);
      // Refresh liked songs
      loadLikedSongs();
    } catch (err) {
      console.error('Failed to like song:', err);
      setError('Failed to like song. Please try again.');
    }
  };

  const handleAddToLibrary = async (song) => {
    if (!isAuthenticated) {
      handleAuthRequired();
      return;
    }

    try {
      await ApiService.addToLibrary(song.spotifyId);
      // Refresh user library
      loadUserLibrary();
    } catch (err) {
      console.error('Failed to add to library:', err);
      setError('Failed to add to library. Please try again.');
    }
  };

  // Load data only when view changes, not on every render
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      if (currentView === 'home' && isMounted) {
        await loadHomePageData();
      } else if (currentView === 'liked' && isAuthenticated && isMounted) {
        await loadLikedSongs();
      } else if (currentView === 'library' && isMounted) {
        await loadUserLibrary();
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [currentView, isAuthenticated]);

  useEffect(() => {
    if (user?.preferences?.theme) {
      document.body.classList.toggle('dark', user.preferences.theme === 'dark');
      document.body.classList.toggle('light', user.preferences.theme === 'light');
    }
  }, [user?.preferences?.theme]);

  const openAuthModal = (mode = 'login') => {
    navigate(mode === 'login' ? '/signin' : '/signup');
  };

  const handleUserMenuClick = () => {
    setShowUserMenu(!showUserMenu);
  };

  const handleLogout = async () => {
    try {
      await logout();
      setShowUserMenu(false);
      setCurrentView('home');
      setUserLibrary([]);
      setLikedSongs([]);
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
              onLikeSong={handleLikeSong}
              onAddToLibrary={handleAddToLibrary}
              showPagination={true}
              currentPage={searchPagination.currentPage}
              totalPages={searchPagination.totalPages}
              onPageChange={handleSearchPageChange}
              isLoading={isSearching}
              searchQuery={searchQuery}
              isAuthenticated={isAuthenticated}
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
              <h2>Your Library</h2>
            </div>
            {isAuthenticated ? (
              <TrackList
                tracks={userLibrary}
                onAuthRequired={handleAuthRequired}
                onLikeSong={handleLikeSong}
                onAddToLibrary={handleAddToLibrary}
                isLoading={isLoading}
                isAuthenticated={isAuthenticated}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                <Library size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                <p>Sign in to see your music library</p>
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
                onLikeSong={handleLikeSong}
                onAddToLibrary={handleAddToLibrary}
                isAuthenticated={isAuthenticated}
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
                <h2>New Releases</h2>
              </div>
              <div className="music-grid">
                {newReleases.length ? (
                  newReleases.slice(0, 8).map((track) => (
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
                        New Release
                      </small>
                    </div>
                  ))
                ) : (
                  <p>No new releases available.</p>
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
                    onClick={() => window.location.href = '/signin'}
                  >
                    Sign In
                  </button>
                  <button
                    className="auth-btn register-btn"
                    onClick={() => window.location.href = '/signup'}
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
            <PlaylistSection onAuthRequired={handleAuthRequired} />
          </aside>

          <main className="main-content">{renderMainContent()}</main>
        </div>
      </div>

      <MusicPlayer
        isMinimized={isPlayerMinimized}
        onToggleMinimize={() => setIsPlayerMinimized(!isPlayerMinimized)}
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
              <Route path="/signin" element={<SignIn />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/login" element={<Navigate to="/signin" />} />
              <Route path="/register" element={<Navigate to="/signup" />} />
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