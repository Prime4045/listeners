import React, { useState, useEffect } from 'react';
import { X, Music, Plus, Search, Check } from 'lucide-react';
import ApiService from '../../services/api';
import './CreatePlaylistModal.css';

const CreatePlaylistModal = ({ isOpen, onClose, onPlaylistCreated, selectedSong = null }) => {
  const [step, setStep] = useState(1); // 1: Create/Select, 2: Add Songs
  const [playlistName, setPlaylistName] = useState('');
  const [playlistDescription, setPlaylistDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isCollaborative, setIsCollaborative] = useState(false);
  const [existingPlaylists, setExistingPlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [createNew, setCreateNew] = useState(true);
  const [availableSongs, setAvailableSongs] = useState([]);
  const [selectedSongs, setSelectedSongs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadExistingPlaylists();
      loadAvailableSongs();
      if (selectedSong) {
        setSelectedSongs([selectedSong]);
      }
    }
  }, [isOpen, selectedSong]);

  const loadExistingPlaylists = async () => {
    try {
      const response = await ApiService.get('/playlists');
      setExistingPlaylists(response.playlists || []);
    } catch (error) {
      console.error('Failed to load playlists:', error);
    }
  };

  const loadAvailableSongs = async () => {
    try {
      const response = await ApiService.getDatabaseSongs(1, 100);
      setAvailableSongs(response.songs || []);
    } catch (error) {
      console.error('Failed to load songs:', error);
    }
  };

  const handleCreatePlaylist = async () => {
    if (!playlistName.trim()) {
      setError('Playlist name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const playlistData = {
        name: playlistName.trim(),
        description: playlistDescription.trim(),
        isPublic,
        isCollaborative,
      };

      const response = await ApiService.post('/playlists', playlistData);
      const newPlaylist = response.playlist;

      // Add selected songs to the playlist
      if (selectedSongs.length > 0) {
        for (const song of selectedSongs) {
          try {
            await ApiService.post(`/playlists/${newPlaylist._id}/songs`, {
              spotifyId: song.spotifyId
            });
          } catch (songError) {
            console.error('Failed to add song to playlist:', songError);
          }
        }
      }

      // Trigger events to update dashboard
      window.dispatchEvent(new CustomEvent('playlist_created'));
      localStorage.setItem('playlist_created', Date.now().toString());
      localStorage.removeItem('playlist_created');

      onPlaylistCreated?.(newPlaylist);
      handleClose();
    } catch (error) {
      console.error('Failed to create playlist:', error);
      setError(error.message || 'Failed to create playlist');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToExistingPlaylist = async () => {
    if (!selectedPlaylist) {
      setError('Please select a playlist');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Add selected songs to the existing playlist
      if (selectedSongs.length > 0) {
        for (const song of selectedSongs) {
          try {
            await ApiService.post(`/playlists/${selectedPlaylist._id}/songs`, {
              spotifyId: song.spotifyId
            });
          } catch (songError) {
            console.error('Failed to add song to playlist:', songError);
          }
        }
      }

      onPlaylistCreated?.(selectedPlaylist);
      handleClose();
    } catch (error) {
      console.error('Failed to add songs to playlist:', error);
      setError(error.message || 'Failed to add songs to playlist');
    } finally {
      setLoading(false);
    }
  };

  const handleSongToggle = (song) => {
    setSelectedSongs(prev => {
      const isSelected = prev.some(s => s.spotifyId === song.spotifyId);
      if (isSelected) {
        return prev.filter(s => s.spotifyId !== song.spotifyId);
      } else {
        return [...prev, song];
      }
    });
  };

  const handleClose = () => {
    setStep(1);
    setPlaylistName('');
    setPlaylistDescription('');
    setIsPublic(false);
    setIsCollaborative(false);
    setSelectedPlaylist(null);
    setCreateNew(true);
    setSelectedSongs([]);
    setSearchQuery('');
    setError(null);
    onClose();
  };

  const filteredSongs = availableSongs.filter(song =>
    song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    song.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="modal-container">
        <div className="modal-header">
          <h2>
            {step === 1 ? 'Create or Select Playlist' : 'Add Songs to Playlist'}
          </h2>
          <button className="modal-close" onClick={handleClose}>
            <X size={24} />
          </button>
        </div>

        <div className="modal-content">
          {error && (
            <div className="error-message">
              <span>{error}</span>
            </div>
          )}

          {step === 1 && (
            <div className="step-content">
              <div className="playlist-options">
                <div className="option-tabs">
                  <button
                    className={`option-tab ${createNew ? 'active' : ''}`}
                    onClick={() => setCreateNew(true)}
                  >
                    <Plus size={16} />
                    Create New Playlist
                  </button>
                  <button
                    className={`option-tab ${!createNew ? 'active' : ''}`}
                    onClick={() => setCreateNew(false)}
                  >
                    <Music size={16} />
                    Add to Existing
                  </button>
                </div>

                {createNew ? (
                  <div className="create-playlist-form">
                    <div className="form-group">
                      <label>Playlist Name *</label>
                      <input
                        type="text"
                        value={playlistName}
                        onChange={(e) => setPlaylistName(e.target.value)}
                        placeholder="Enter playlist name"
                        maxLength={100}
                      />
                    </div>

                    <div className="form-group">
                      <label>Description (Optional)</label>
                      <textarea
                        value={playlistDescription}
                        onChange={(e) => setPlaylistDescription(e.target.value)}
                        placeholder="Describe your playlist"
                        maxLength={500}
                        rows={3}
                      />
                    </div>

                    <div className="form-options">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={isPublic}
                          onChange={(e) => setIsPublic(e.target.checked)}
                        />
                        <span className="checkbox-custom"></span>
                        Make playlist public
                      </label>

                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={isCollaborative}
                          onChange={(e) => setIsCollaborative(e.target.checked)}
                        />
                        <span className="checkbox-custom"></span>
                        Allow others to edit
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="existing-playlists">
                    {existingPlaylists.length > 0 ? (
                      <div className="playlists-list">
                        {existingPlaylists.map(playlist => (
                          <div
                            key={playlist._id}
                            className={`playlist-item ${selectedPlaylist?._id === playlist._id ? 'selected' : ''}`}
                            onClick={() => setSelectedPlaylist(playlist)}
                          >
                            <div className="playlist-info">
                              <h4>{playlist.name}</h4>
                              <p>{playlist.songs?.length || 0} songs</p>
                            </div>
                            {selectedPlaylist?._id === playlist._id && (
                              <Check size={20} className="check-icon" />
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="empty-state">
                        <Music size={48} />
                        <p>No playlists found</p>
                        <span>Create your first playlist to get started</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="step-actions">
                <button
                  className="btn-secondary"
                  onClick={handleClose}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  onClick={() => setStep(2)}
                  disabled={createNew ? !playlistName.trim() : !selectedPlaylist}
                >
                  Next: Add Songs
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="step-content">
              <div className="songs-section">
                <div className="search-container">
                  <Search className="search-icon" size={18} />
                  <input
                    type="text"
                    placeholder="Search songs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                  />
                </div>

                <div className="selected-count">
                  {selectedSongs.length} song{selectedSongs.length !== 1 ? 's' : ''} selected
                </div>

                <div className="songs-list">
                  {filteredSongs.map(song => {
                    const isSelected = selectedSongs.some(s => s.spotifyId === song.spotifyId);
                    return (
                      <div
                        key={song.spotifyId}
                        className={`song-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleSongToggle(song)}
                      >
                        <div className="song-image">
                          <img
                            src={song.imageUrl || 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=60'}
                            alt={song.title}
                            onError={(e) => {
                              e.target.src = 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=60';
                            }}
                          />
                        </div>
                        <div className="song-info">
                          <h4>{song.title}</h4>
                          <p>{song.artist}</p>
                        </div>
                        {isSelected && (
                          <Check size={20} className="check-icon" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="step-actions">
                <button
                  className="btn-secondary"
                  onClick={() => setStep(1)}
                >
                  Back
                </button>
                <button
                  className="btn-primary"
                  onClick={createNew ? handleCreatePlaylist : handleAddToExistingPlaylist}
                  disabled={loading}
                >
                  {loading ? 'Creating...' : createNew ? 'Create Playlist' : 'Add to Playlist'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreatePlaylistModal;