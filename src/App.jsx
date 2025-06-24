import { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Volume2,
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
import MusicPlayer from './components/MusicPlayer/MusicPlayer';
import AuthModal from './components/auth/AuthModal';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { MusicProvider, useMusic } from './contexts/MusicContext';
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
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreSongs, setHasMoreSongs] = useState(true);

  const {
    currentTrack,
    isPlaying,
    playTrack,
    togglePlayPause,
    toggleShuffle,
    previousTrack,
    nextTrack,
    toggleRepeat,
    seekTo,
    setVolume,
    formatTime,
    currentTime,
    duration,
    progress,
    volume,
    isShuffled,
    repeatMode,
  } = useMusic();

  const { user, isAuthenticated, logout, loading: authLoading } = useAuth();

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim() && searchQuery.length >= 2) {
        handleSearch();
      } else if (searchQuery.trim() === '') {
        setSearchResults([]);
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
      const response = await ApiService.getDatabaseSongs(page, 50);

      if (page === 1) {
        setDatabaseSongs(response.songs || []);
      } else {
        setDatabaseSongs(prev => [...prev, ...(response.songs || [])]);
      }

      setHasMoreSongs(response.pagination?.hasNext || false);
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

  const handleSearch = async () => {
    if (!searchQuery.trim() || searchQuery.length < 2) return;

    try {
      setIsSearching(true);
      setError(null);

      const results = await ApiService.searchMusic(searchQuery.trim(), 20);
      console.log('Search results:', {
        query: searchQuery,
        total: results.songs?.length,
        spotifyCount: results.spotifyCount,
      });
      setSearchResults(results.songs || []);
      setCurrentView('search');
    } catch (error) {
      console.error('Search failed:', error);
      setError(`Search failed: ${error.message || 'Unable to fetch songs from Spotify'}. Please try again.`);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
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
      handleSearch();
    }
  };

  useEffect(() => {
    if (currentView === 'home') {
      loadDatabaseSongs();
      fetchTrendingSongs();
    } else if (currentView === 'liked' && isAuthenticated) {
      loadLikedSongs();
    }
  }, [currentView, isAuthenticated]);

  const handleTrackSelect = async (track) => {
    try {
      setError(null);

      if (!track.canPlay) {
        setError(track.message || 'This song is not available for playback yet.');
        return;
      }

      if (!isAuthenticated) {
        setAuthModal({ isOpen: true, mode: 'login' });
        return;
      }

      const response = await ApiService.playTrack(track.spotifyId);
      const tracks = currentView === 'search' ? searchResults : 
                   currentView === 'liked' ? likedSongs : databaseSongs;

      const updatedTrack = {
        ...track,
        audioUrl: response.audioUrl,
        isInDatabase: response.isInDatabase,
        canPlay: true,
        spotifyData: response.spotifyData,
      };

      if (response.isNewlyAdded && currentView === 'search') {
        setSearchResults(prev =>
          prev.map(t =>
            t.spotifyId === track.spotifyId ? { ...t, isInDatabase: true } : t
          )
        );
        // Refresh available songs to include newly added song
        await loadDatabaseSongs(1);
      }

      await playTrack(updatedTrack, tracks);
    } catch (err) {
      console.error('Failed to play track:', err);
      setError(err.message || 'Failed to play track. Please try again.');
    }
  };

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
    if (currentView === 'player') {
      return <MusicPlayer />;
    }

    switch (currentView) {
      case 'search':
        return (
          <div className="library-view">
            <div className="section-header">
              <Search className="section-icon" />
              <h2>
                {isSearching ? 'Searching...' : searchQuery ? `Results for "${searchQuery}"` : 'Search Music'}
              </h2>
            </div>

            {error && (
              <div className="error-message">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            {isSearching && (
              <div className="loading-indicator">
                <Loader2 className="animate-spin" size={20} />
                <span>Searching for music...</span>
              </div>
            )}

            {!isSearching && searchResults.length > 0 && (
              <TrackList
                tracks={searchResults}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                onTrackSelect={handleTrackSelect}
                onTogglePlay={togglePlayPause}
              />
            )}

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
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              onTrackSelect={handleTrackSelect}
              onTogglePlay={togglePlayPause}
            />
            {hasMoreSongs && (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <button
                  onClick={() => {
                    const nextPage = currentPage + 1;
                    setCurrentPage(nextPage);
                    loadDatabaseSongs(nextPage);
                  }}
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
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                onTrackSelect={handleTrackSelect}
                onTogglePlay={togglePlayPause}
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
                      className={`music-card ${currentTrack?.spotifyId === track.spotifyId ? 'playing' : ''}`}
                      onClick={() => handleTrackSelect(track)}
                    >
                      <div className="card-image">
                        <img
                          src={track.imageUrl || 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=300'}
                          alt={track.title}
                          onError={(e) => {
                            e.target.src = 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=300';
                          }}
                        />
                        <button className="play-btn">
                          {currentTrack?.spotifyId === track.spotifyId && isPlaying ? (
                            <Pause size={16} />
                          ) : (
                            <Play size={16} />
                          )}
                        </button>
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
                      className={`music-card ${currentTrack?.spotifyId === track.spotifyId ? 'playing' : ''}`}
                      onClick={() => handleTrackSelect(track)}
                    >
                      <div className="card-image">
                        <img
                          src={track.imageUrl || 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=300'}
                          alt={track.title}
                          onError={(e) => {
                            e.target.src = 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=300';
                          }}
                        />
                        <button className="play-btn">
                          {currentTrack?.spotifyId === track.spotifyId && isPlaying ? (
                            <Pause size={16} />
                          ) : (
                            <Play size={16} />
                          )}
                        </button>
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
                    animation: 'spin 1s linear infinite'
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
                              : user?.username
                            }
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
                        <button className="dropdown-item">
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
                        <button className="dropdown-item logout" onClick={handleLogout}>
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

      {currentView !== 'player' && (
        <div className="player-bar">
          <div className="player-track">
            <div className="track-cover">
              <img
                src={currentTrack?.imageUrl || 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=100'}
                alt={currentTrack?.title || 'No track'}
                style={{ width: '56px', height: '56px', borderRadius: '8px', objectFit: 'cover' }}
                onError={(e) => {
                  e.target.src = 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=100';
                }}
              />
            </div>
            <div className="track-info">
              <div className="track-title">{currentTrack?.title || 'No track selected'}</div>
              <div className="track-artist">
                {currentTrack?.artist || ''} {currentTrack?.duration ? `• ${formatTime(currentTrack.duration / 1000)}` : ''}
              </div>
            </div>
          </div>

          <div className="player-controls">
            <div className="control-buttons">
              <button
                className={`control-btn ${isShuffled ? 'active' : ''}`}
                onClick={toggleShuffle}
              >
                <Shuffle size={16} />
              </button>
              <button className="control-btn" onClick={previousTrack}>
                <SkipBack size={16} />
              </button>
              <button
                className="play-pause-btn"
                onClick={togglePlayPause}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              </button>
              <button className="control-btn" onClick={nextTrack}>
                <SkipForward size={16} />
              </button>
              <button
                className={`control-btn ${repeatMode !== 'none' ? 'active' : ''}`}
                onClick={toggleRepeat}
              >
                <Repeat size={16} />
              </button>
            </div>

            <div className="progress-bar">
              <span className="time">{formatTime(currentTime)}</span>
              <div
                className="progress"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const percent = (e.clientX - rect.left) / rect.width;
                  seekTo(percent * 100);
                }}
              >
                <div className="progress-fill" style={{ width: `${progress}%` }}></div>
              </div>
              <span className="time">{formatTime(duration)}</span>
            </div>
          </div>

          <div className="volume-controls">
            <Volume2 size={16} className="control-btn" />
            <div className="volume-bar">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => {
                  const newVolume = parseFloat(e.target.value);
                  setVolume(newVolume);
                }}
                className="volume-slider"
                style={{
                  background: `linear-gradient(to right, #8b5cf6 ${volume * 100}%, #535353 ${volume * 100}%)`,
                }}
              />
            </div>
          </div>
        </div>
      )}

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
    <ErrorBoundary>
      <AuthProvider>
        <MusicProvider>
          <AppContent />
        </MusicProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;