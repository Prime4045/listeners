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
  Clock,
  TrendingUp,
  Loader2,
  Settings,
  LogOut,
  Shield,
} from 'lucide-react';
import TrackList from './components/TrackList';
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

// Format duration from milliseconds to min:sec
const formatDuration = (ms) => {
  if (!ms) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const AppContent = () => {
  const [currentView, setCurrentView] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [trendingSongs, setTrendingSongs] = useState([]);
  const [bollywoodAlbums, setBollywoodAlbums] = useState([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [authModal, setAuthModal] = useState({ isOpen: false, mode: 'login' });
  const [showUserMenu, setShowUserMenu] = useState(false);

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

  // Debounced search function
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
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Fetch trending songs
  const fetchTrendingSongs = async () => {
    try {
      setIsLoading(true);
      const songs = await ApiService.getTrendingSongs(10);
      setTrendingSongs(songs || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch trending songs:', err);
      setError('Failed to load trending songs. Using offline mode.');
      // Fallback to sample data
      setTrendingSongs([
        {
          spotifyId: 'sample1',
          title: 'Sample Song 1',
          artist: 'Sample Artist',
          album: 'Sample Album',
          duration: 180000,
          previewUrl: '/audio/sample.mp3',
          imageUrl: null,
        },
        {
          spotifyId: 'sample2',
          title: 'Sample Song 2',
          artist: 'Another Artist',
          album: 'Another Album',
          duration: 210000,
          previewUrl: '/audio/sample.mp3',
          imageUrl: null,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch Bollywood albums
  const fetchBollywoodAlbums = async () => {
    try {
      const albums = await ApiService.getBollywoodAlbums(10);
      setBollywoodAlbums(albums || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch Bollywood albums:', err);
      setError('Failed to load Bollywood albums. Using offline mode.');
      // Fallback to sample data
      setBollywoodAlbums([
        {
          spotifyId: 'album1',
          title: 'Sample Album 1',
          artist: 'Bollywood Artist',
          imageUrl: null,
          totalTracks: 10,
        },
        {
          spotifyId: 'album2',
          title: 'Sample Album 2',
          artist: 'Another Bollywood Artist',
          imageUrl: null,
          totalTracks: 8,
        },
      ]);
    }
  };

  // Fetch recently played for authenticated users
  const fetchRecentlyPlayed = async () => {
    if (!isAuthenticated) {
      // Load from localStorage for non-authenticated users
      const stored = localStorage.getItem('recentlyPlayed');
      if (stored) {
        try {
          setRecentlyPlayed(JSON.parse(stored));
        } catch (e) {
          console.error('Failed to parse stored recently played:', e);
        }
      }
      return;
    }

    try {
      const userData = await ApiService.getCurrentUser();
      const songs = userData.user.recentlyPlayed
        ?.map((item) => ({
          spotifyId: item.song.spotifyId,
          title: item.song.title,
          artist: item.song.artist,
          album: item.song.album,
          duration: item.song.duration,
          previewUrl: item.song.previewUrl,
          imageUrl: item.song.imageUrl,
          playedAt: item.playedAt,
        }))
        .reverse() || [];
      setRecentlyPlayed(songs);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch recently played:', err);
      // Don't show error for this, just use local storage
    }
  };

  // Enhanced search function
  const handleSearch = async () => {
    if (!searchQuery.trim() || searchQuery.length < 2) return;

    try {
      setIsSearching(true);
      setError(null);

      const results = await ApiService.searchMusic(searchQuery.trim(), 20);
      setSearchResults(results || []);
      setCurrentView('search');
    } catch (error) {
      console.error('Search failed:', error);
      setError(`Search failed: ${error.message}. Please try again.`);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle search input changes
  const handleSearchInputChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);

    // Show search view immediately when typing
    if (value.trim() && currentView !== 'search') {
      setCurrentView('search');
    }
  };

  // Handle search form submission
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      handleSearch();
    }
  };

  useEffect(() => {
    if (currentView === 'home') {
      fetchTrendingSongs();
      fetchBollywoodAlbums();
      fetchRecentlyPlayed();
    }
  }, [currentView, isAuthenticated]);

  const handleTrackSelect = async (trackOrAlbum, isAlbum = false) => {
    let track = trackOrAlbum;

    if (isAlbum) {
      try {
        setIsLoading(true);
        track = await ApiService.getAlbumTrack(trackOrAlbum.spotifyId);
      } catch (err) {
        console.error('Failed to fetch album track:', err);
        setError('Failed to play album track. Please try again.');
        return;
      } finally {
        setIsLoading(false);
      }
    }

    if (!track.previewUrl) {
      setError('This track is not playable (no preview available).');
      return;
    }

    const tracks = currentView === 'search' ? searchResults : trendingSongs;
    playTrack(track, tracks);

    // Update recently played
    const recentTrack = { ...track, playedAt: new Date().toISOString() };

    if (isAuthenticated) {
      try {
        await ApiService.playTrack(track.spotifyId);
        fetchRecentlyPlayed();
      } catch (err) {
        console.error('Failed to update recently played on server:', err);
        // Still update locally
        updateLocalRecentlyPlayed(recentTrack);
      }
    } else {
      updateLocalRecentlyPlayed(recentTrack);
    }
  };

  const updateLocalRecentlyPlayed = (track) => {
    setRecentlyPlayed((prev) => {
      const updated = [
        track,
        ...prev.filter((t) => t.spotifyId !== track.spotifyId),
      ].slice(0, 5);

      // Store in localStorage
      localStorage.setItem('recentlyPlayed', JSON.stringify(updated));
      return updated;
    });
  };

  // Apply user theme
  useEffect(() => {
    if (user?.preferences?.theme) {
      document.body.classList.toggle('dark', user.preferences.theme === 'dark');
      document.body.classList.toggle('light', user.preferences.theme === 'light');
    }
  }, [user?.preferences?.theme]);

  // Handle auth modal
  const openAuthModal = (mode = 'login') => {
    setAuthModal({ isOpen: true, mode });
  };

  const closeAuthModal = () => {
    setAuthModal({ isOpen: false, mode: 'login' });
  };

  // Handle user menu
  const handleUserMenuClick = () => {
    setShowUserMenu(!showUserMenu);
  };

  const handleLogout = async () => {
    try {
      await logout();
      setShowUserMenu(false);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showUserMenu && !event.target.closest('.user-menu-container')) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserMenu]);

  const renderMainContent = () => {
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
              <div className="error-message" style={{
                color: '#ef4444',
                background: 'rgba(239, 68, 68, 0.1)',
                padding: '1rem',
                borderRadius: '8px',
                margin: '1rem 0'
              }}>
                {error}
              </div>
            )}

            {isSearching && (
              <div className="loading-indicator" style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '2rem',
                justifyContent: 'center'
              }}>
                <Loader2 className="animate-spin" size={20} />
                <span>Searching for music...</span>
              </div>
            )}

            {!isSearching && searchResults.length > 0 && (
              <TrackList
                tracks={searchResults}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                onTrackSelect={(track) => handleTrackSelect(track)}
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
              <h2>Your Library</h2>
            </div>
            <TrackList
              tracks={trendingSongs}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              onTrackSelect={(track) => handleTrackSelect(track)}
            />
          </div>
        );
      case 'liked':
        return (
          <div className="library-view">
            <div className="section-header">
              <Heart className="section-icon" />
              <h2>Liked Songs</h2>
            </div>
            <TrackList
              tracks={trendingSongs.slice(0, 4)}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              onTrackSelect={(track) => handleTrackSelect(track)}
            />
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
              <div className="error-message" style={{
                color: '#ef4444',
                background: 'rgba(239, 68, 68, 0.1)',
                padding: '1rem',
                borderRadius: '8px',
                margin: '1rem 0'
              }}>
                {error}
              </div>
            )}

            {isLoading && (
              <div className="loading-indicator" style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '1rem',
                justifyContent: 'center'
              }}>
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
                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }}
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
                <h2>Bollywood Albums</h2>
              </div>
              <div className="music-grid">
                {bollywoodAlbums.length ? (
                  bollywoodAlbums.slice(0, 8).map((album) => (
                    <div
                      key={album.spotifyId}
                      className={`music-card ${currentTrack?.album === album.title ? 'playing' : ''}`}
                      onClick={() => handleTrackSelect(album, true)}
                    >
                      <div className="card-image">
                        <img
                          src={album.imageUrl || 'https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg?auto=compress&cs=tinysrgb&w=300'}
                          alt={album.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }}
                          onError={(e) => {
                            e.target.src = 'https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg?auto=compress&cs=tinysrgb&w=300';
                          }}
                        />
                        <button className="play-btn">
                          <Play size={16} />
                        </button>
                      </div>
                      <h3>{album.title}</h3>
                      <p>{album.artist}</p>
                    </div>
                  ))
                ) : (
                  <p>No Bollywood albums available.</p>
                )}
              </div>
            </div>

            {recentlyPlayed.length > 0 && (
              <div className="music-section">
                <div className="section-header">
                  <Clock className="section-icon" />
                  <h2>Recently Played</h2>
                </div>
                <div className="music-grid">
                  {recentlyPlayed.slice(0, 5).map((track) => (
                    <div
                      key={track.spotifyId}
                      className={`music-card ${currentTrack?.spotifyId === track.spotifyId ? 'playing' : ''}`}
                      onClick={() => handleTrackSelect(track)}
                    >
                      <div className="card-image">
                        <img
                          src={track.imageUrl || 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=300'}
                          alt={track.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }}
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
                    </div>
                  ))}
                </div>
              </div>
            )}
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
              {currentTrack?.artist || ''} {currentTrack?.duration ? `• ${formatDuration(currentTrack.duration)}` : ''}
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
                localStorage.setItem('playerVolume', newVolume);
              }}
              className="volume-slider"
              style={{
                background: `linear-gradient(to right, #8b5cf6 ${volume * 100}%, #535353 ${volume * 100}%)`,
              }}
            />
          </div>
        </div>
      </div>

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