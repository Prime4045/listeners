import { useState } from 'react'
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
  TrendingUp
} from 'lucide-react'
import TrackList from './components/TrackList'
import WaveformPlayer from './components/WaveformPlayer'
import { AuthProvider } from './contexts/AuthContext'
import { MusicProvider, useMusic } from './contexts/MusicContext'
import './App.css'

// Sample data
const sampleTracks = [
  {
    id: 1,
    title: "Midnight Dreams",
    artist: "Luna Echo",
    duration: "3:45",
    fileUrl: "/audio/sample.mp3"
  },
  {
    id: 2,
    title: "Electric Pulse",
    artist: "Neon Waves",
    duration: "4:12",
    fileUrl: "/audio/sample.mp3"
  },
  {
    id: 3,
    title: "Ocean Breeze",
    artist: "Coastal Vibes",
    duration: "3:28",
    fileUrl: "/audio/sample.mp3"
  },
  {
    id: 4,
    title: "City Lights",
    artist: "Urban Sound",
    duration: "2:56",
    fileUrl: "/audio/sample.mp3"
  },
  {
    id: 5,
    title: "Starlight",
    artist: "Cosmic Journey",
    duration: "4:33",
    fileUrl: "/audio/sample.mp3"
  },
  {
    id: 6,
    title: "Rhythm Flow",
    artist: "Beat Masters",
    duration: "3:21",
    fileUrl: "/audio/sample.mp3"
  },
  {
    id: 7,
    title: "Digital Love",
    artist: "Cyber Hearts",
    duration: "3:47",
    fileUrl: "/audio/sample.mp3"
  },
  {
    id: 8,
    title: "Sunset Glow",
    artist: "Golden Hour",
    duration: "4:05",
    fileUrl: "/audio/sample.mp3"
  }
]

const samplePlaylists = [
  { id: 1, name: "Chill Vibes", songCount: 24 },
  { id: 2, name: "Workout Mix", songCount: 18 },
  { id: 3, name: "Study Focus", songCount: 32 },
  { id: 4, name: "Road Trip", songCount: 45 },
  { id: 5, name: "Late Night", songCount: 16 }
]

// Enhanced App component with contexts
const AppContent = () => {
  const [currentView, setCurrentView] = useState('home')
  const music = useMusic()

  const handleTrackSelect = (track) => {
    music.playTrack(track, sampleTracks)
  }

  const renderMainContent = () => {
    switch (currentView) {
      case 'library':
        return (
          <div className="library-view">
            <div className="section-header">
              <Library className="section-icon" />
              <h2>Your Library</h2>
            </div>
            <TrackList 
              tracks={sampleTracks} 
              currentTrack={music.currentTrack}
              isPlaying={music.isPlaying}
              onTrackSelect={handleTrackSelect}
            />
          </div>
        )
      case 'liked':
        return (
          <div className="library-view">
            <div className="section-header">
              <Heart className="section-icon" />
              <h2>Liked Songs</h2>
            </div>
            <TrackList 
              tracks={sampleTracks.slice(0, 4)} 
              currentTrack={music.currentTrack}
              isPlaying={music.isPlaying}
              onTrackSelect={handleTrackSelect}
            />
          </div>
        )
      case 'waveform':
        return (
          <div className="library-view">
            <div className="section-header">
              <Music className="section-icon" />
              <h2>Audio Visualizer</h2>
            </div>
            <div className="waveform-section">
              <WaveformPlayer
                audioUrl={music.currentTrack?.fileUrl || '/audio/sample.mp3'}
                isPlaying={music.isPlaying}
                onPlayPause={(playing) => playing ? music.togglePlayPause() : music.togglePlayPause()}
                height={120}
              />
              <div className="track-details">
                <h3>{music.currentTrack?.title || 'No track selected'}</h3>
                <p>{music.currentTrack?.artist || 'Select a track to see waveform'}</p>
              </div>
            </div>
          </div>
        )
      default:
        return (
          <>
            <div className="welcome-section">
              <h1>Good evening</h1>
              <p>Discover new music and enjoy your favorites</p>
            </div>

            <div className="music-section">
              <div className="section-header">
                <TrendingUp className="section-icon" />
                <h2>Trending Now</h2>
              </div>
              <div className="music-grid">
                {sampleTracks.map((track) => (
                  <div 
                    key={track.id} 
                    className={`music-card ${music.currentTrack?.id === track.id ? 'playing' : ''}`}
                    onClick={() => handleTrackSelect(track)}
                  >
                    <div className="card-image">
                      <button className="play-btn">
                        {music.currentTrack?.id === track.id && music.isPlaying ? (
                          <Pause size={20} />
                        ) : (
                          <Play size={20} />
                        )}
                      </button>
                    </div>
                    <h3>{track.title}</h3>
                    <p>{track.artist}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="music-section">
              <div className="section-header">
                <Clock className="section-icon" />
                <h2>Recently Played</h2>
              </div>
              <div className="music-grid">
                {sampleTracks.slice(2, 8).map((track) => (
                  <div 
                    key={track.id} 
                    className={`music-card ${music.currentTrack?.id === track.id ? 'playing' : ''}`}
                    onClick={() => handleTrackSelect(track)}
                  >
                    <div className="card-image">
                      <button className="play-btn">
                        {music.currentTrack?.id === track.id && music.isPlaying ? (
                          <Pause size={20} />
                        ) : (
                          <Play size={20} />
                        )}
                      </button>
                    </div>
                    <h3>{track.title}</h3>
                    <p>{track.artist}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )
    }
  }

  return (
    <div className="app">
      <div className="app-container">
        {/* Header */}
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
                placeholder="Search for songs, artists, or albums..."
                className="search-input"
              />
            </div>
          </div>
          
          <div className="header-right">
            <div className="user-menu">
              <User className="user-icon" />
            </div>
          </div>
        </header>

        <div className="main-layout">
          {/* Sidebar */}
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

          {/* Main Content */}
          <main className="main-content">
            {renderMainContent()}
          </main>
        </div>
      </div>

      {/* Enhanced Player Bar */}
      <div className="player-bar">
        <div className="player-track">
          <div className="track-cover"></div>
          <div className="track-info">
            <div className="track-title">{music.currentTrack?.title || 'No track selected'}</div>
            <div className="track-artist">{music.currentTrack?.artist || ''}</div>
          </div>
        </div>

        <div className="player-controls">
          <div className="control-buttons">
            <button 
              className={`control-btn ${music.isShuffled ? 'active' : ''}`}
              onClick={music.toggleShuffle}
            >
              <Shuffle size={16} />
            </button>
            <button className="control-btn" onClick={music.previousTrack}>
              <SkipBack size={16} />
            </button>
            <button className="play-pause-btn" onClick={music.togglePlayPause}>
              {music.isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <button className="control-btn" onClick={music.nextTrack}>
              <SkipForward size={16} />
            </button>
            <button 
              className={`control-btn ${music.repeatMode !== 'none' ? 'active' : ''}`}
              onClick={music.toggleRepeat}
            >
              <Repeat size={16} />
            </button>
          </div>
          
          <div className="progress-bar">
            <span className="time">{music.formatTime(music.currentTime)}</span>
            <div className="progress" onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const percent = (e.clientX - rect.left) / rect.width;
              music.seekTo(percent * music.duration);
            }}>
              <div 
                className="progress-fill" 
                style={{ width: `${music.progress}%` }}
              ></div>
            </div>
            <span className="time">{music.formatTime(music.duration)}</span>
          </div>
        </div>

        <div className="volume-controls">
          <Volume2 size={16} className="control-btn" />
          <div className="volume-bar">
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={music.volume}
              onChange={(e) => music.setVolume(parseFloat(e.target.value))}
              className="volume-slider"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// Main App component with providers
function App() {
  return (
    <AuthProvider>
      <MusicProvider>
        <AppContent />
      </MusicProvider>
    </AuthProvider>
  )
}

export default App