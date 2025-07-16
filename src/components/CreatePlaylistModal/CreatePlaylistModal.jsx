import React, { useState, useEffect } from 'react';
import { X, Music, Plus, Check, Sparkles } from 'lucide-react';
import ApiService from '../../services/api';
import './CreatePlaylistModal.css';

const CreatePlaylistModal = ({ isOpen, onClose, onPlaylistCreated, selectedSong = null }) => {
  const [playlistName, setPlaylistName] = useState('');
  const [existingPlaylists, setExistingPlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [createNew, setCreateNew] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadExistingPlaylists();
      // Reset form
      setPlaylistName('');
      setSelectedPlaylist(null);
      setCreateNew(true);
      setError(null);
    }
  }, [isOpen]);

  const loadExistingPlaylists = async () => {
    try {
      const response = await ApiService.getPlaylists();
      setExistingPlaylists(response.playlists || []);
    } catch (error) {
      console.error('Failed to load playlists:', error);
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
        description: '',
        isPublic: false,
        isCollaborative: false,
      };

      const response = await ApiService.post('/playlists', playlistData);
      const newPlaylist = response.playlist;

      // Add selected song to the playlist if provided
      if (selectedSong) {
        try {
          await ApiService.post(`/playlists/${newPlaylist._id}/songs`, {
            spotifyId: selectedSong.spotifyId
          });
        } catch (songError) {
          console.error('Failed to add song to playlist:', songError);
        }
      }

      // Trigger events to update dashboard and playlist section
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

    if (!selectedSong) {
      setError('No song selected to add');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await ApiService.post(`/playlists/${selectedPlaylist._id}/songs`, {
        spotifyId: selectedSong.spotifyId
      });

      onPlaylistCreated?.(selectedPlaylist);
      handleClose();
    } catch (error) {
      console.error('Failed to add song to playlist:', error);
      setError(error.message || 'Failed to add song to playlist');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPlaylistName('');
    setSelectedPlaylist(null);
    setCreateNew(true);
    setError(null);
    onClose();
  };

  const handleSubmit = () => {
    if (createNew) {
      handleCreatePlaylist();
    } else {
      handleAddToExistingPlaylist();
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
    ];
    return gradients[index % gradients.length];
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="modal-container">
        <div className="modal-header">
          <div className="modal-title">
            <Sparkles size={20} />
            <h2>{selectedSong ? 'Add to Playlist' : 'Create Playlist'}</h2>
          </div>
          <button className="modal-close" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-content">
          {error && (
            <div className="error-message">
              <span>{error}</span>
            </div>
          )}

          <div className="step-content">
            {selectedSong && existingPlaylists.length > 0 && (
              <div className="option-tabs">
                <button
                  className={`option-tab ${createNew ? 'active' : ''}`}
                  onClick={() => setCreateNew(true)}
                >
                  <Plus size={16} />
                  Create New
                </button>
                <button
                  className={`option-tab ${!createNew ? 'active' : ''}`}
                  onClick={() => setCreateNew(false)}
                >
                  <Music size={16} />
                  Add to Existing
                </button>
              </div>
            )}

            {createNew ? (
              <div className="create-section">
                <div className="create-preview">
                  <div className="preview-artwork">
                    <Music size={32} />
                  </div>
                  <div className="preview-info">
                    <h3>{playlistName || 'My Playlist #1'}</h3>
                    <p>0 songs</p>
                  </div>
                </div>

                <div className="form-group">
                  <label>Give your playlist a name</label>
                  <input
                    type="text"
                    value={playlistName}
                    onChange={(e) => setPlaylistName(e.target.value)}
                    placeholder="My Playlist #1"
                    maxLength={100}
                    autoFocus
                    className="playlist-name-input"
                  />
                </div>
              </div>
            ) : (
              <div className="existing-section">
                <h3>Choose a playlist</h3>
                {existingPlaylists.length > 0 ? (
                  <div className="playlists-grid">
                    {existingPlaylists.map((playlist, index) => (
                      <div
                        key={playlist._id}
                        className={`playlist-card ${selectedPlaylist?._id === playlist._id ? 'selected' : ''}`}
                        onClick={() => setSelectedPlaylist(playlist)}
                      >
                        <div 
                          className="playlist-cover"
                          style={{ background: getPlaylistGradient(index) }}
                        >
                          <Music size={20} />
                        </div>
                        <div className="playlist-info">
                          <h4>{playlist.name}</h4>
                          <p>{playlist.songs?.length || 0} songs</p>
                        </div>
                        {selectedPlaylist?._id === playlist._id && (
                          <div className="selection-indicator">
                            <Check size={16} />
                          </div>
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

            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={handleClose}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleSubmit}
                disabled={loading || (createNew ? !playlistName.trim() : !selectedPlaylist)}
              >
                {loading ? (
                  <div className="loading-spinner"></div>
                ) : createNew ? (
                  <>
                    <Plus size={16} />
                    Create
                  </>
                ) : (
                  <>
                    <Music size={16} />
                    Add Song
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreatePlaylistModal;