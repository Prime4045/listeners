import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, 
  Clock, 
  Music, 
  Play, 
  Pause,
  Heart,
  Plus,
  Sparkles,
  Radio,
  Disc3,
  Headphones,
  Star
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useMusic } from '../../contexts/MusicContext';
import TrackList from '../../components/TrackList';
import ApiService from '../../services/api';
import './Home.css';

const Home = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { currentTrack, isPlaying, playTrack } = useMusic();
  
  const [trendingSongs, setTrendingSongs] = useState([]);
  const [databaseSongs, setDatabaseSongs] = useState([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState('trending');

  useEffect(() => {
    loadHomeData();
  }, []);

  const loadHomeData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [trendingResponse, databaseResponse] = await Promise.all([
        ApiService.getTrendingSongs(20),
        ApiService.getDatabaseSongs(1, 20)
      ]);

      setTrendingSongs(trendingResponse || []);
      setDatabaseSongs(databaseResponse.songs || []);

      // Load recently played if authenticated
      if (isAuthenticated) {
        try {
          const historyResponse = await ApiService.getPlayHistory(10);
          setRecentlyPlayed(historyResponse || []);
        } catch (historyError) {
          console.log('No play history available');
        }
      }
    } catch (err) {
      console.error('Failed to load home data:', err);
      setError('Failed to load music data');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickPlay = async (tracks) => {
    if (tracks.length === 0) return;
    
    const playableTracks = tracks.filter(track => track.canPlay);
    if (playableTracks.length === 0) return;

    try {
      await playTrack(playableTracks[0], playableTracks);
    } catch (error) {
      console.error('Failed to play tracks:', error);
    }
  };

  const handleLikeSong = async (song) => {
    if (!isAuthenticated) {
      navigate('/signin');
      return;
    }

    try {
      await ApiService.likeTrack(song.spotifyId);
      // Trigger dashboard update
      window.dispatchEvent(new CustomEvent('liked_songs_updated'));
    } catch (error) {
      console.error('Failed to like song:', error);
    }
  };

  const handleAddToLibrary = async (song) => {
    if (!isAuthenticated) {
      navigate('/signin');
      return;
    }

    try {
      await ApiService.addToLibrary(song.spotifyId);
    } catch (error) {
      console.error('Failed to add to library:', error);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const sections = [
    { id: 'trending', label: 'Trending', icon: TrendingUp, data: trendingSongs },
    { id: 'database', label: 'Available Songs', icon: Music, data: databaseSongs },
    ...(isAuthenticated && recentlyPlayed.length > 0 ? [
      { id: 'recent', label: 'Recently Played', icon: Clock, data: recentlyPlayed }
    ] : [])
  ];

  const activeData = sections.find(s => s.id === activeSection)?.data || [];

  if (loading) {
    return (
      <div className="home-loading">
        <div className="loading-content">
          <div className="loading-animation">
            <div className="music-wave">
              <div className="wave-bar"></div>
              <div className="wave-bar"></div>
              <div className="wave-bar"></div>
              <div className="wave-bar"></div>
              <div className="wave-bar"></div>
            </div>
          </div>
          <h3>Loading your music...</h3>
          <p>Preparing the best tracks for you</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="home-error">
        <div className="error-content">
          <div className="error-icon">
            <Music size={64} />
          </div>
          <h2>Something went wrong</h2>
          <p>{error}</p>
          <button onClick={loadHomeData} className="retry-btn">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="home">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-text">
            <h1 className="hero-title">
              {getGreeting()}{isAuthenticated ? `, ${user?.firstName || user?.username}` : ''}
            </h1>
            <p className="hero-subtitle">
              {isAuthenticated 
                ? "Ready to discover your next favorite song?"
                : "Discover millions of songs and create your perfect playlist"
              }
            </p>
          </div>
          
          <div className="hero-actions">
            {!isAuthenticated ? (
              <button 
                className="cta-button primary"
                onClick={() => navigate('/signup')}
              >
                <Sparkles size={20} />
                Get Started Free
              </button>
            ) : (
              <div className="quick-actions">
                <button 
                  className="quick-action-btn"
                  onClick={() => handleQuickPlay(trendingSongs)}
                  disabled={trendingSongs.length === 0}
                >
                  <Play size={20} />
                  Play Trending
                </button>
                <button 
                  className="quick-action-btn secondary"
                  onClick={() => navigate('/search')}
                >
                  <Radio size={20} />
                  Discover
                </button>
              </div>
            )}
          </div>
        </div>
        
        <div className="hero-visual">
          <div className="floating-elements">
            <div className="floating-disc disc-1">
              <Disc3 size={40} />
            </div>
            <div className="floating-disc disc-2">
              <Headphones size={36} />
            </div>
            <div className="floating-disc disc-3">
              <Music size={32} />
            </div>
          </div>
        </div>
      </section>

      {/* Quick Stats */}
      {isAuthenticated && (
        <section className="quick-stats">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">
                <Heart size={20} />
              </div>
              <div className="stat-content">
                <span className="stat-number">0</span>
                <span className="stat-label">Liked Songs</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">
                <Music size={20} />
              </div>
              <div className="stat-content">
                <span className="stat-number">0</span>
                <span className="stat-label">Playlists</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">
                <Clock size={20} />
              </div>
              <div className="stat-content">
                <span className="stat-number">{recentlyPlayed.length}</span>
                <span className="stat-label">Recent Tracks</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Music Sections */}
      <section className="music-sections">
        <div className="section-tabs">
          {sections.map((section) => (
            <button
              key={section.id}
              className={`section-tab ${activeSection === section.id ? 'active' : ''}`}
              onClick={() => setActiveSection(section.id)}
            >
              <section.icon size={18} />
              <span>{section.label}</span>
              <span className="tab-count">{section.data.length}</span>
            </button>
          ))}
        </div>

        <div className="section-content">
          <div className="section-header">
            <div className="section-info">
              <h2>{sections.find(s => s.id === activeSection)?.label}</h2>
              <p>
                {activeSection === 'trending' && 'Most popular tracks right now'}
                {activeSection === 'database' && 'Songs available for streaming'}
                {activeSection === 'recent' && 'Your recently played tracks'}
              </p>
            </div>
            
            {activeData.length > 0 && (
              <div className="section-actions">
                <button 
                  className="play-all-btn"
                  onClick={() => handleQuickPlay(activeData)}
                >
                  {currentTrack && activeData.some(track => track.spotifyId === currentTrack.spotifyId) && isPlaying ? (
                    <Pause size={16} />
                  ) : (
                    <Play size={16} />
                  )}
                  Play All
                </button>
                <button className="shuffle-btn">
                  <Radio size={16} />
                  Shuffle
                </button>
              </div>
            )}
          </div>

          {activeData.length > 0 ? (
            <TrackList
              tracks={activeData}
              onAuthRequired={() => navigate('/signin')}
              onLikeSong={handleLikeSong}
              onAddToLibrary={handleAddToLibrary}
              isAuthenticated={isAuthenticated}
              showAddedDate={activeSection === 'recent'}
            />
          ) : (
            <div className="empty-section">
              <div className="empty-content">
                <div className="empty-icon">
                  {activeSection === 'trending' && <TrendingUp size={48} />}
                  {activeSection === 'database' && <Music size={48} />}
                  {activeSection === 'recent' && <Clock size={48} />}
                </div>
                <h3>No {sections.find(s => s.id === activeSection)?.label.toLowerCase()} found</h3>
                <p>
                  {activeSection === 'trending' && 'Check back later for trending music'}
                  {activeSection === 'database' && 'No songs available at the moment'}
                  {activeSection === 'recent' && 'Start listening to see your recent tracks'}
                </p>
                {activeSection === 'recent' && (
                  <button 
                    className="discover-btn"
                    onClick={() => setActiveSection('trending')}
                  >
                    <Star size={16} />
                    Discover Music
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Call to Action for Non-Authenticated Users */}
      {!isAuthenticated && (
        <section className="cta-section">
          <div className="cta-content">
            <div className="cta-text">
              <h2>Ready to start your music journey?</h2>
              <p>Join millions of music lovers and create your perfect soundtrack</p>
            </div>
            <div className="cta-actions">
              <button 
                className="cta-button primary"
                onClick={() => navigate('/signup')}
              >
                <Plus size={20} />
                Sign Up Free
              </button>
              <button 
                className="cta-button secondary"
                onClick={() => navigate('/signin')}
              >
                Log In
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default Home;