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
  { id: 1, title: "Midnight Dreams", artist: "Luna Echo", album: "Nocturnal", duration: "3:45" },
  { id: 2, title: "Electric Pulse", artist: "Neon Waves", album: "Synthwave", duration: "4:12" },
  { id: 3, title: "Ocean Breeze", artist: "Coastal Vibes", album: "Summer", duration: "3:28" },
  { id: 4, title: "City Lights", artist: "Urban Sound", album: "Metropolitan", duration: "4:01" },
  { id: 5, title: "Starlight", artist: "Cosmic Journey", album: "Galaxy", duration: "5:15" },
  { id: 6, title: "Rhythm Flow", artist: "Beat Masters", album: "Groove", duration: "3:33" },
  { id: 7, title: "Digital Love", artist: "Cyber Hearts", album: "Future", duration: "4:28" },
  { id: 8, title: "Sunset Glow", artist: "Golden Hour", album: "Warmth", duration: "3:52" }
]

const samplePlaylists = [
  { id: 1, name: "Chill Vibes", trackCount: 24 },
  { id: 2, name: "Workout Mix", trackCount: 18 },
  { id: 3, name: "Study Focus", trackCount: 32 },
  { id: 4, name: "Road Trip", trackCount: 45 },
  { id: 5, name: "Late Night", trackCount: 16 }
]

function App() {
  const [currentTrack, setCurrentTrack] = useState(sampleTracks[0])
  const [isPlaying, setIsPlaying] = useState(false)
  const [activeNav, setActiveNav] = useState('home')

  const togglePlay = () => {
    setIsPlaying(!isPlaying)
  }

  const playTrack = (track) => {
    setCurrentTrack(track)
    setIsPlaying(true)
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="logo">
          <div className="logo-icon">
            <Music size={20} color="white" />
          </div>
          <span className="gradient-text">Listeners</span>
        </div>
        
        <div className="search-bar">
          <Search className="search-icon" />
          <input 
            type="text" 
            placeholder="Search for songs, artists, or albums..." 
            className="search-input"
          />
        </div>
        
        <div className="user-menu">
          <div className="user-avatar">
            <User size={18} color="white" />
          </div>
        </div>
      </header>

      <div className="main-content">
        {/* Sidebar */}
        <aside className="sidebar">
          <nav className="nav-section">
            <h3 className="nav-title">Menu</h3>
            <ul className="nav-list">
              <li 
                className={`nav-item ${activeNav === 'home' ? 'active' : ''}`}
                onClick={() => setActiveNav('home')}
              >
                <Home className="nav-icon" />
                <span>Home</span>
              </li>
              <li 
                className={`nav-item ${activeNav === 'library' ? 'active' : ''}`}
                onClick={() => setActiveNav('library')}
              >
                <Library className="nav-icon" />
                <span>Your Library</span>
              </li>
              <li 
                className={`nav-item ${activeNav === 'liked' ? 'active' : ''}`}
                onClick={() => setActiveNav('liked')}
              >
                <Heart className="nav-icon" />
                <span>Liked Songs</span>
              </li>
            </ul>
          </nav>

          <div className="nav-section">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 className="nav-title">Playlists</h3>
              <Plus size={16} className="nav-icon" style={{ cursor: 'pointer' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {samplePlaylists.map(playlist => (
                <div key={playlist.id} className="playlist-item">
                  <div className="playlist-cover"></div>
                  <div className="playlist-info">
                    <div className="playlist-name">{playlist.name}</div>
                    <div className="playlist-count">{playlist.trackCount} songs</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="content-area">
          {activeNav === 'home' && (
            <>
              <div className="content-header">
                <h1 className="content-title">Good evening</h1>
                <p className="content-subtitle">Discover new music and enjoy your favorites</p>
              </div>

              <section className="featured-section">
                <h2 className="section-title">
                  <TrendingUp size={20} />
                  Trending Now
                </h2>
                <div className="music-grid">
                  {sampleTracks.slice(0, 6).map(track => (
                    <div key={track.id} className="music-card hover-lift" onClick={() => playTrack(track)}>
                      <div className="album-cover">
                        <button className="play-button">
                          <Play size={16} color="white" />
                        </button>
                      </div>
                      <h3 className="track-title">{track.title}</h3>
                      <p className="track-artist">{track.artist}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="featured-section">
                <h2 className="section-title">
                  <Clock size={20} />
                  Recently Played
                </h2>
                <div className="music-grid">
                  {sampleTracks.slice(2, 8).map(track => (
                    <div key={track.id} className="music-card hover-lift" onClick={() => playTrack(track)}>
                      <div className="album-cover">
                        <button className="play-button">
                          <Play size={16} color="white" />
                        </button>
                      </div>
                      <h3 className="track-title">{track.title}</h3>
                      <p className="track-artist">{track.artist}</p>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {activeNav === 'library' && (
            <>
              <div className="content-header">
                <h1 className="content-title">Your Library</h1>
                <p className="content-subtitle">All your music in one place</p>
              </div>

              <TrackList 
                tracks={sampleTracks}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                onTrackSelect={playTrack}
                onTogglePlay={togglePlay}
              />
            </>
          )}

          {activeNav === 'liked' && (
            <>
              <div className="content-header">
                <h1 className="content-title">Liked Songs</h1>
                <p className="content-subtitle">Songs you've liked</p>
              </div>

              <TrackList 
                tracks={sampleTracks.slice(0, 4)}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                onTrackSelect={playTrack}
                onTogglePlay={togglePlay}
              />
            </>
          )}
        </main>
      </div>

      {/* Player Bar */}
      <div className="player-bar">
        <div className="now-playing">
          <div className="current-track-cover"></div>
          <div className="current-track-info">
            <div className="current-track-title">{currentTrack.title}</div>
            <div className="current-track-artist">{currentTrack.artist}</div>
          </div>
        </div>

        <div className="player-controls">
          <div className="control-buttons">
            <button className="control-btn">
              <Shuffle size={16} />
            </button>
            <button className="control-btn">
              <SkipBack size={16} />
            </button>
            <button className="control-btn play-btn" onClick={togglePlay}>
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button className="control-btn">
              <SkipForward size={16} />
            </button>
            <button className="control-btn">
              <Repeat size={16} />
            </button>
          </div>
          
          <div className="progress-container">
            <span className="time-display">1:23</span>
            <div className="progress-bar">
              <div className="progress-fill"></div>
            </div>
            <span className="time-display">{currentTrack.duration}</span>
          </div>
        </div>

        <div className="volume-controls">
          <Volume2 size={16} className="control-btn" />
          <div className="volume-bar">
            <div className="volume-fill"></div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
