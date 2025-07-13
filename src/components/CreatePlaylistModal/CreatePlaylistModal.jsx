import React, { useState, useEffect } from 'react';
import { X, Music, Plus, Search, Check } from 'lucide-react';
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

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="modal-container">
        <div className="modal-header">
          <h2>
            {selectedSong ? 'Add to Playlist' : 'Create Playlist'}
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
              <div className="create-playlist-form">
                <div className="form-group">
                  <label>Playlist Name *</label>
                  <input
                    type="text"
                    value={playlistName}
                    onChange={(e) => setPlaylistName(e.target.value)}
                    placeholder="Enter playlist name"
                    maxLength={100}
                    autoFocus
                  />
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

            <div className="step-actions">
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
                {loading ? 'Processing...' : createNew ? 'Create Playlist' : 'Add to Playlist'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreatePlaylistModal;