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
  Filter,
  Grid3X3,
  List,
  Search,
  MoreHorizontal,
  Shuffle,
  Users,
  Globe,
  Lock
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useMusic } from '../../contexts/MusicContext';
import TrackList from '../../components/TrackList';
import CreatePlaylistModal from '../../components/CreatePlaylistModal/CreatePlaylistModal';
import ApiService from '../../services/api';
import './Library.css';

const Library = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { currentTrack, isPlaying, playTrack } = useMusic();
  
  const [activeTab, setActiveTab] = useState('playlists');
  const [viewMode, setViewMode] = useState('grid');
  const [playlists, setPlaylists] = useState([]);
  const [likedSongs, setLikedSongs] = useState([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
        setPlaylists(playlistsResponse.value.playlists || []);
      }

      if (likedResponse.status === 'fulfilled') {
        setLikedSongs(likedResponse.value || []);
      }

      if (historyResponse.status === 'fulfilled') {
        setRecentlyPlayed(historyResponse.value || []);
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

  const filteredPlaylists = playlists.filter(playlist =>
    playlist.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredLikedSongs = likedSongs.filter(song =>
    song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    song.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const tabs = [
    { id: 'playlists', label: 'Playlists', icon: Music, count: playlists.length },
    { id: 'liked', label: 'Liked Songs', icon: Heart, count: likedSongs.length },
    { id: 'recent', label: 'Recently Played', icon: Clock, count: recentlyPlayed.length },
    { id: 'downloaded', label: 'Downloaded', icon: Download, count: 0 }
  ];

  if (loading) {
    return (
      <div className="library-page">
        <div className="library-loading">
          <div className="loading-content">
            <div className="loading-spinner"></div>
            <h3>Loading your library...</h3>
            <p>Getting your music collection ready</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="library-page">
      {/* Header */}
      <div className="library-header">
        <div className="header-content">
          <div className="header-left">
            <h1>Your Library</h1>
            <p>Your music collection and playlists</p>
          </div>
          <div className="header-actions">
            <button
              className="create-playlist-btn"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus size={16} />
              Create Playlist
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="library-search">
          <div className="search-container">
            <Search className="search-icon" size={16} />
            <input
              type="text"
              placeholder="Search in your library"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="library-tabs">
          <div className="tabs-container">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <tab.icon size={18} />
                <span>{tab.label}</span>
                <span className="tab-count">{tab.count}</span>
              </button>
            ))}
          </div>

          {/* View Controls */}
          <div className="view-controls">
            <div className="view-mode-toggle">
              <button
                className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Grid view"
              >
                <Grid3X3 size={16} />
              </button>
              <button
                className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                title="List view"
              >
                <List size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="library-content">
        {activeTab === 'playlists' && (
          <div className="playlists-section">
            {filteredPlaylists.length > 0 ? (
              <>
                <div className="section-header">
                  <div className="section-info">
                    <h2>Your Playlists</h2>
                    <p>{filteredPlaylists.length} playlists</p>
                  </div>
                  {filteredPlaylists.length > 0 && (
                    <button
                      className="shuffle-all-btn"
                      onClick={() => {
                        // Shuffle all playlists
                        const allSongs = filteredPlaylists.flatMap(p => p.songs || []);
                        handlePlayAll(allSongs);
                      }}
                    >
                      <Shuffle size={16} />
                      Shuffle all
                    </button>
                  )}
                </div>

                <div className={`playlists-${viewMode}`}>
                  {filteredPlaylists.map((playlist, index) => (
                    <div
                      key={playlist._id}
                      className="playlist-card"
                      onClick={() => navigate(`/playlist/${playlist._id}`)}
                    >
                      <div 
                        className="playlist-cover"
                        style={{ background: getPlaylistGradient(index) }}
                      >
                        <Music size={viewMode === 'grid' ? 32 : 24} />
                        <div className="play-overlay">
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
                      </div>
                      
                      <div className="playlist-info">
                        <h3 className="playlist-name">{playlist.name}</h3>
                        <div className="playlist-meta">
                          {getPlaylistIcon(playlist)}
                          <span>{playlist.songs?.length || 0} songs</span>
                          {playlist.playCount > 0 && (
                            <>
                              <span>•</span>
                              <span>{playlist.playCount} plays</span>
                            </>
                          )}
                        </div>
                        {playlist.description && (
                          <p className="playlist-description">{playlist.description}</p>
                        )}
                      </div>

                      <div className="playlist-actions">
                        <button className="action-btn" title="More options">
                          <MoreHorizontal size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
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
              <>
                <div className="section-header">
                  <div className="section-info">
                    <h2>Liked Songs</h2>
                    <p>{filteredLikedSongs.length} songs</p>
                  </div>
                  <div className="section-actions">
                    <button
                      className="play-all-btn"
                      onClick={() => handlePlayAll(filteredLikedSongs)}
                    >
                      <Play size={16} />
                      Play all
                    </button>
                    <button
                      className="shuffle-btn"
                      onClick={() => {
                        const shuffled = [...filteredLikedSongs].sort(() => Math.random() - 0.5);
                        handlePlayAll(shuffled);
                      }}
                    >
                      <Shuffle size={16} />
                      Shuffle
                    </button>
                  </div>
                </div>

                <TrackList
                  tracks={filteredLikedSongs}
                  onAuthRequired={() => navigate('/signin')}
                  onLikeSong={async (song) => {
                    try {
                      await ApiService.likeTrack(song.spotifyId);
                      loadLibraryData();
                    } catch (error) {
                      console.error('Failed to like song:', error);
                    }
                  }}
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
              </>
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
              <>
                <div className="section-header">
                  <div className="section-info">
                    <h2>Recently Played</h2>
                    <p>{recentlyPlayed.length} songs</p>
                  </div>
                  <div className="section-actions">
                    <button
                      className="play-all-btn"
                      onClick={() => handlePlayAll(recentlyPlayed)}
                    >
                      <Play size={16} />
                      Play all
                    </button>
                  </div>
                </div>

                <TrackList
                  tracks={recentlyPlayed}
                  onAuthRequired={() => navigate('/signin')}
                  onLikeSong={async (song) => {
                    try {
                      await ApiService.likeTrack(song.spotifyId);
                    } catch (error) {
                      console.error('Failed to like song:', error);
                    }
                  }}
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
              </>
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

        {activeTab === 'downloaded' && (
          <div className="downloaded-section">
            <div className="empty-section">
              <div className="empty-content">
                <div className="empty-icon">
                  <Download size={64} />
                </div>
                <h3>No downloaded music</h3>
                <p>Download songs for offline listening</p>
                <button
                  className="premium-btn"
                  onClick={() => {
                    // Navigate to premium page
                  }}
                >
                  <TrendingUp size={16} />
                  Get Premium
                </button>
              </div>
            </div>
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