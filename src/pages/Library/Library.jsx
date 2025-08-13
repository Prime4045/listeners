import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Music, 
  Heart, 
  Clock, 
  Download, 
  TrendingUp,
  Play,
  Pause,
  Plus,
  Search,
  Grid3X3,
  List,
  Shuffle,
  Users,
  Globe,
  Lock,
  MoreHorizontal,
  Filter,
  SortAsc,
  Calendar,
  Star,
  Headphones,
  Radio,
  Disc3,
  X
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useMusic } from '../../contexts/MusicContext';
import { useNotifications } from '../../contexts/NotificationContext';
import TrackList from '../../components/TrackList';
import CreatePlaylistModal from '../../components/CreatePlaylistModal/CreatePlaylistModal';
import ApiService from '../../services/api';
import './Library.css';

const Library = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { currentTrack, isPlaying, playTrack } = useMusic();
  const { addNotification } = useNotifications();
  
  const [activeTab, setActiveTab] = useState('playlists');
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('recent');
  const [playlists, setPlaylists] = useState([]);
  const [likedSongs, setLikedSongs] = useState([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({
    totalPlaylists: 0,
    totalLikedSongs: 0,
    totalListeningTime: 0,
    recentActivity: 0
  });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/signin');
      return;
    }
    loadLibraryData();
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    const handleUpdate = () => {
      if (isAuthenticated) {
        loadLibraryData();
      }
    };

    window.addEventListener('playlist_created', handleUpdate);
    window.addEventListener('liked_songs_updated', handleUpdate);
    
    return () => {
      window.removeEventListener('playlist_created', handleUpdate);
      window.removeEventListener('liked_songs_updated', handleUpdate);
    };
  }, [isAuthenticated]);

  const loadLibraryData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [playlistsResponse, likedResponse, historyResponse] = await Promise.allSettled([
        ApiService.getPlaylists(),
        ApiService.getLikedSongs(50),
        ApiService.getPlayHistory(20)
      ]);

      if (playlistsResponse.status === 'fulfilled') {
        const playlists = playlistsResponse.value.playlists || [];
        setPlaylists(playlists);
        setStats(prev => ({ ...prev, totalPlaylists: playlists.length }));
      }

      if (likedResponse.status === 'fulfilled') {
        const liked = likedResponse.value || [];
        setLikedSongs(liked);
        setStats(prev => ({ ...prev, totalLikedSongs: liked.length }));
      }

      if (historyResponse.status === 'fulfilled') {
        const history = historyResponse.value || [];
        setRecentlyPlayed(history);
        
        // Calculate total listening time (in minutes)
        const totalTime = history.reduce((acc, track) => acc + (track.playDuration || 0), 0);
        setStats(prev => ({ 
          ...prev, 
          totalListeningTime: Math.round(totalTime / 60000),
          recentActivity: history.length
        }));
      }

    } catch (err) {
      console.error('Failed to load library:', err);
      setError('Failed to load your library');
    } finally {
      setLoading(false);
    }
  };

  const handlePlaylistCreated = (playlist) => {
    setPlaylists(prev => [playlist, ...prev]);
    setShowCreateModal(false);
    
    // Add notification
    addNotification?.({
      type: 'playlist_created',
      title: 'Playlist Created',
      message: `"${playlist.name}" has been created successfully`,
      data: { playlistId: playlist._id }
    });
  };

  const handlePlayAll = async (tracks) => {
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
    try {
      await ApiService.likeTrack(song.spotifyId);
      loadLibraryData();
      
      // Add notification
      addNotification?.({
        type: 'song_liked',
        title: 'Song Liked',
        message: `Added "${song.title}" to your liked songs`,
        data: { songId: song.spotifyId }
      });
    } catch (error) {
      console.error('Failed to like song:', error);
    }
  };

  const getPlaylistGradient = (index) => {
    const gradients = [
      'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
      'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
      'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
    ];
    return gradients[index % gradients.length];
  };

  const getPlaylistIcon = (playlist) => {
    if (playlist.isPublic) return <Globe size={12} />;
    if (playlist.isCollaborative) return <Users size={12} />;
    return <Lock size={12} />;
  };

  const sortPlaylists = (playlists) => {
    switch (sortBy) {
      case 'name':
        return [...playlists].sort((a, b) => a.name.localeCompare(b.name));
      case 'songs':
        return [...playlists].sort((a, b) => (b.songs?.length || 0) - (a.songs?.length || 0));
      case 'recent':
      default:
        return [...playlists].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
  };

  const filteredPlaylists = sortPlaylists(playlists).filter(playlist =>
    playlist.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredLikedSongs = likedSongs.filter(song =>
    song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    song.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const tabs = [
    { id: 'playlists', label: 'Playlist', icon: Music, count: playlists.length },
    { id: 'liked', label: 'Liked Song', icon: Heart, count: likedSongs.length },
    { id: 'recent', label: 'Minute', icon: Clock, count: Math.round(stats.totalListeningTime) }
  ];

  if (loading) {
    return (
      <div className="library-page">
        <div className="library-loading">
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
            <h3>Loading your library...</h3>
            <p>Getting your music collection ready</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="library-page">
      {/* Header with Title and Stats */}
      <div className="library-header">
        <div className="header-left">
          <h1 className="library-title">Your Music Library</h1>
          <p className="library-subtitle">Your personal collection of music and playlists</p>
        </div>
        
        <div className="header-stats">
          {tabs.map((tab) => (
            <div key={tab.id} className="stat-pill">
              <tab.icon size={16} />
              <span className="stat-label">{tab.label}</span>
              <span className="stat-count">{tab.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Controls Bar */}
      <div className="library-controls">
        <div className="controls-left">
          <div className="search-container">
            <Search className="search-icon" size={16} />
            <input
              type="text"
              placeholder="Search in your library..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            {searchQuery && (
              <button
                className="clear-search"
                onClick={() => setSearchQuery('')}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="controls-center">
          <div className="filter-buttons">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`filter-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <tab.icon size={16} />
                <span>{tab.label}</span>
                <span className="filter-count">{tab.count}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="controls-right">
          <button
            className="create-playlist-btn"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={16} />
            Create Playlist
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="library-content">
        {activeTab === 'playlists' && (
          <div className="playlists-section">
            {filteredPlaylists.length > 0 ? (
              <div className="playlists-grid">
                {filteredPlaylists.map((playlist, index) => (
                  <div
                    key={playlist._id}
                    className="playlist-card"
                    onClick={() => navigate(`/playlist/${playlist._id}`)}
                  >
                    <div className="playlist-cover">
                      <div
                        className="cover-gradient"
                        style={{ background: getPlaylistGradient(index) }}
                      >
                        <Music size={32} />
                      </div>
                      <div className="cover-overlay">
                        <button
                          className="play-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            const songs = playlist.songs?.map(item => item.song).filter(Boolean) || [];
                            handlePlayAll(songs);
                          }}
                        >
                          <Play size={20} />
                        </button>
                      </div>
                      <div className="playlist-badge">
                        {getPlaylistIcon(playlist)}
                      </div>
                    </div>
                    
                    <div className="playlist-info">
                      <h3 className="playlist-name">{playlist.name}</h3>
                      <p className="playlist-meta">{playlist.songs?.length || 0} songs</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-section">
                <div className="empty-content">
                  <div className="empty-icon">
                    <Music size={64} />
                  </div>
                  <h3>No playlists yet</h3>
                  <p>Create your first playlist to organize your favorite music</p>
                  <button
                    className="create-first-btn"
                    onClick={() => setShowCreateModal(true)}
                  >
                    <Plus size={16} />
                    Create your first playlist
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'liked' && (
          <div className="liked-section">
            {filteredLikedSongs.length > 0 ? (
              <TrackList
                tracks={filteredLikedSongs}
                onAuthRequired={() => navigate('/signin')}
                onLikeSong={handleLikeSong}
                onAddToLibrary={async (song) => {
                  try {
                    await ApiService.addToLibrary(song.spotifyId);
                  } catch (error) {
                    console.error('Failed to add to library:', error);
                  }
                }}
                isAuthenticated={isAuthenticated}
                showAddedDate={true}
              />
            ) : (
              <div className="empty-section">
                <div className="empty-content">
                  <div className="empty-icon">
                    <Heart size={64} />
                  </div>
                  <h3>No liked songs yet</h3>
                  <p>Songs you like will appear here</p>
                  <button
                    className="discover-btn"
                    onClick={() => navigate('/search')}
                  >
                    <TrendingUp size={16} />
                    Discover music
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'recent' && (
          <div className="recent-section">
            {recentlyPlayed.length > 0 ? (
              <TrackList
                tracks={recentlyPlayed}
                onAuthRequired={() => navigate('/signin')}
                onLikeSong={handleLikeSong}
                onAddToLibrary={async (song) => {
                  try {
                    await ApiService.addToLibrary(song.spotifyId);
                  } catch (error) {
                    console.error('Failed to add to library:', error);
                  }
                }}
                isAuthenticated={isAuthenticated}
                showAddedDate={true}
              />
            ) : (
              <div className="empty-section">
                <div className="empty-content">
                  <div className="empty-icon">
                    <Clock size={64} />
                  </div>
                  <h3>No recent activity</h3>
                  <p>Your recently played songs will appear here</p>
                  <button
                    className="discover-btn"
                    onClick={() => navigate('/')}
                  >
                    <Music size={16} />
                    Start listening
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <CreatePlaylistModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onPlaylistCreated={handlePlaylistCreated}
      />
    </div>
  );
};

export default Library;