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
} from 'lucide-react';
import TrackList from './components/TrackList';
import WaveformPlayer from './components/WaveformPlayer';
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
  const [trendingSongs, setTrendingSongs] = useState([]);
  const [bollywoodAlbums, setBollywoodAlbums] = useState([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState([]);
  const [error, setError] = useState(null);
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
  const { user, isAuthenticated, logout } = useAuth();

  // Fetch trending songs (10)
  const fetchTrendingSongs = async () => {
    try {
      const songs = await ApiService.request('GET', '/music/trending-songs');
      setTrendingSongs(songs);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch trending songs:', err);
      setError('Failed to load trending songs. Please try again.');
    }
  };

  // Fetch Bollywood albums (10)
  const fetchBollywoodAlbums = async () => {
    try {
      const albums = await ApiService.request('GET', '/music/bollywood-albums');
      setBollywoodAlbums(albums);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch Bollywood albums:', err);
      setError('Failed to load Bollywood albums. Please try again.');
    }
  };

  // Fetch recently played for authenticated users
  const fetchRecentlyPlayed = async () => {
    if (!isAuthenticated) {
      setRecentlyPlayed([]);
      return;
    }
    try {
      const userData = await ApiService.request('GET', '/auth/me');
      const songs = userData.recentlyPlayed
        .map((item) => ({
          spotifyId: item.song.spotifyId,
          title: item.song.title,
          artist: item.song.artist,
          album: item.song.album,
          duration: item.song.duration,
          previewUrl: item.song.previewUrl,
          imageUrl: item.song.imageUrl,
          playedAt: item.playedAt,
        }))
        .reverse();
      setRecentlyPlayed(songs);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch recently played:', err);
      setError('Failed to load recently played tracks.');
    }
  };

  useEffect(() => {
    if (currentView === 'home') {
      fetchTrendingSongs();
      fetchBollywoodAlbums();
      fetchRecentlyPlayed();
    }
  }, [currentView, isAuthenticated]);

  const handleSearch = async () => {
    if (!searchQuery) return;
    try {
      const results = await ApiService.request('GET', `/music/search?query=${encodeURIComponent(searchQuery)}`);
      setSearchResults(results);
      setCurrentView('search');
      setError(null);
    } catch (error) {
      console.error('Search failed:', error);
      setError('Search failed. Please try again.');
    }
  };

  const handleTrackSelect = async (trackOrAlbum, isAlbum = false) => {
    let track = trackOrAlbum;

    if (isAlbum) {
      try {
        track = await ApiService.request('GET', `/music/albums/${trackOrAlbum.spotifyId}/track`);
      } catch (err) {
        console.error('Failed to fetch album track:', err);
        setError('Failed to play album track. Please try again.');
        return;
      }
    }

    if (!track.previewUrl) {
      setError('This track is not playable.');
      return;
    }

    const tracks = currentView === 'search' ? searchResults : trendingSongs;
    playTrack(track, tracks);

    if (isAuthenticated) {
      ApiService.request('POST', `/music/${track.spotifyId}/play`)
        .then(() => fetchRecentlyPlayed())
        .catch((err) => console.error('Failed to update recently played:', err));
    } else {
      setRecentlyPlayed((prev) => {
        const updated = [
          ...prev.filter((t) => t.spotifyId !== track.spotifyId),
          { ...track, playedAt: new Date() },
        ].slice(-5);
        return updated.reverse();
      });
    }
  };

  // Apply user theme
  useEffect(() => {
    if (user?.preferences?.theme) {
      document.body.classList.toggle('dark', user.preferences.theme === 'dark');
      document.body.classList.toggle('light', user.preferences.theme === 'light');
    }
  }, [user?.preferences?.theme]);

  const renderMainContent = () => {
    switch (currentView) {
      case 'search':
        return (
          <div className="library-view">
            <div className="section-header">
              <Search className="section-icon" />
              <h2>Search Results</h2>
            </div>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <TrackList
              tracks={searchResults}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              onTrackSelect={(track) => handleTrackSelect(track)}
            />
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
      case 'waveform':
        return (
          <div className="library-view">
            <div className="section-header">
              <Music className="section-icon" />
              <h2>Track Visualizer</h2>
            </div>
            <div className="waveform-section">
              <WaveformPlayer
                audioUrl={currentTrack?.previewUrl || '/audio/sample.mp3'}
                isPlaying={isPlaying}
                onPlayPause={() => togglePlayPause()}
                height={120}
              />
              <div className="track-details">
                <h3>{currentTrack?.title || 'No track selected'}</h3>
                <p>{currentTrack?.artist || 'Select a track to see waveform'}</p>
              </div>
            </div>
          </div>
        );
      default:
        return (
          <>
            <div className="welcome-section">
              <h1>Good evening, {user?.username || 'Guest'}</h1>
              <p>Discover new music and enjoy your favorites</p>
            </div>

            {error && <p style={{ color: 'red', margin: '10px' }}>{error}</p>}

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
                          src={track.imageUrl || '/placeholder.jpg'}
                          alt={track.title}
                          style={{ width: '100%', borderRadius: '8px' }}
                        />
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
                          src={album.imageUrl || '/placeholder.jpg'}
                          alt={album.title}
                          style={{ width: '100%', borderRadius: '8px' }}
                        />
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

            <div className="music-section">
              <div className="section-header">
                <Clock className="section-icon" />
                <h2>Recently Played</h2>
              </div>
              <div className="music-grid">
                {recentlyPlayed.length ? (
                  recentlyPlayed.slice(0, 5).map((track) => (
                    <div
                      key={track.spotifyId}
                      className={`music-card ${currentTrack?.spotifyId === track.spotifyId ? 'playing' : ''}`}
                      onClick={() => handleTrackSelect(track)}
                    >
                      <div className="card-image">
                        <img
                          src={track.imageUrl || '/placeholder.jpg'}
                          alt={track.title}
                          style={{ width: '100%', borderRadius: '8px' }}
                        />
                      </div>
                      <h3>{track.title}</h3>
                      <p>{track.artist}</p>
                    </div>
                  ))
                ) : (
                  <p>No recently played songs.</p>
                )}
              </div>
            </div>
          </>
        );
    }
  };

  return (
    <div className="app">
      <div className="app-container">
        <header className="header">
          <div className="header-left">
            <div className="logo">
              <Music className="logo-icon" />
              <span className="logo-text">Listeners</span>
            </div>
          </div>

          <div className="header-center">
            <div className="search-bar">
              <Search className="search-icon" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search for songs, artists, or albums..."
                className="search-input"
                aria-label="Search for songs, artists, or albums"
              />
            </div>
          </div>

          <div className="header-right">
            <div className="user-menu">
              {isAuthenticated ? (
                <>
                  <span>{user?.username}</span>
                  <button onClick={logout} style={{ marginLeft: '10px', background: 'none', border: 'none', color: '#fff' }}>
                    Logout
                  </button>
                </>
              ) : (
                <a href="/login" style={{ color: '#fff' }}>
                  <User className="user-icon" />
                </a>
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
                <li
                  className={`nav-item ${currentView === 'waveform' ? 'active' : ''}`}
                  onClick={() => setCurrentView('waveform')}
                >
                  <Music className="nav-icon" />
                  <span>Visualizer</span>
                </li>
              </ul>
            </nav>
            <div className="playlists">
              <div className="playlists-header">
                <h3 className="nav-title">PLAYLISTS</h3>
                <Plus className="add-playlist-btn" />
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
              src={currentTrack?.imageUrl || '/placeholder.jpg'}
              alt={currentTrack?.title}
              style={{ width: '40px', height: '40px', borderRadius: '4px' }}
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
                background: `linear-gradient(to right, #1db954 ${volume * 100}%, #535353 ${volume * 100}%)`,
              }}
            />
          </div>
        </div>
      </div>
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