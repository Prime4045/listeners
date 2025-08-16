import React, { useState, useEffect } from 'react';
import { useMusic } from '../contexts/MusicContext';
import CreatePlaylistModal from './CreatePlaylistModal/CreatePlaylistModal';
import './TrackList.css';

const TrackList = ({
  tracks = [],
  onAuthRequired,
  onLikeSong,
  onAddToLibrary,
  showPagination = false,
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  isLoading = false,
  searchQuery = '',
  isAuthenticated = false,
  showAddedDate = false
}) => {
  const { currentTrack, isPlaying, playTrack } = useMusic();
  const [likedTracks, setLikedTracks] = useState(new Set());
  const [libraryTracks, setLibraryTracks] = useState(new Set());
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [selectedSongForPlaylist, setSelectedSongForPlaylist] = useState(null);

  const formatDuration = (ms) => {
    if (!ms) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handlePlayTrack = async (track) => {
    try {
      await playTrack(track, tracks);

      // Trigger song played event for dashboard update
      window.dispatchEvent(new CustomEvent('song_played'));
    } catch (error) {
      console.error('Failed to play track:', error);
    }
  };

  const handleLikeTrack = async (track, e) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      onAuthRequired?.();
      return;
    }

    try {
      await onLikeSong?.(track);
      // Toggle like status locally
      const newLikedTracks = new Set(likedTracks);
      if (likedTracks.has(track.spotifyId)) {
        newLikedTracks.delete(track.spotifyId);
      } else {
        newLikedTracks.add(track.spotifyId);
      }
      setLikedTracks(newLikedTracks);
      
      // Trigger notification update
      window.dispatchEvent(new CustomEvent('song_liked', { 
        detail: { track, liked: !likedTracks.has(track.spotifyId) }
      }));
    } catch (error) {
      console.error('Failed to like track:', error);
    }
  };

  const handleAddToLibrary = async (track, e) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      onAuthRequired?.();
      return;
    }

    try {
      await onAddToLibrary?.(track);
      // Toggle library status locally
      const newLibraryTracks = new Set(libraryTracks);
      if (libraryTracks.has(track.spotifyId)) {
        newLibraryTracks.delete(track.spotifyId);
      } else {
        newLibraryTracks.add(track.spotifyId);
      }
      setLibraryTracks(newLibraryTracks);
    } catch (error) {
      console.error('Failed to add to library:', error);
    }
  };

  const handleAddToPlaylist = (track, e) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      onAuthRequired?.();
      return;
    }
    setSelectedSongForPlaylist(track);
    setShowPlaylistModal(true);
  };

  const handlePlaylistCreated = (playlist) => {
    console.log('Song added to playlist:', playlist.name);
    setShowPlaylistModal(false);
    setSelectedSongForPlaylist(null);
  };

  const isCurrentTrack = (track) => currentTrack?.spotifyId === track.spotifyId;
  const isTrackLiked = (track) => likedTracks.has(track.spotifyId);
  const isTrackInLibrary = (track) => libraryTracks.has(track.spotifyId);

  if (tracks.length === 0 && !isLoading) {
    return (
      <div className="track-list-empty">
        <i className='bx bx-music' style={{ fontSize: '48px' }}></i>
        <h3>No tracks found</h3>
        <p>
          {searchQuery
            ? `No results found for "${searchQuery}". Try different keywords.`
            : 'No tracks available at the moment.'
          }
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="track-list-container">
        {isLoading && (
          <div className="track-list-loading">
            <i className='bx bx-loader-alt bx-spin' style={{ fontSize: '24px' }}></i>
            <p>Loading tracks...</p>
          </div>
        )}

        {!isLoading && tracks.length > 0 && (
          <>
            <div className="track-list">
              <div className="track-list-header">
                <div className="header-number">#</div>
                <div className="header-title">Title</div>
                <div className="header-album">Album</div>
                <div className="header-duration">
                  <i className='bx bx-hourglass' style={{ fontSize: '16px' }}></i>
                </div>
                <div className="header-album">Actions</div>
              </div>

              <div className="track-list-body">
                {tracks.map((track, index) => (
                  <div
                    key={track.spotifyId}
                    className={`track-row ${isCurrentTrack(track) ? 'active' : ''} ${!track.canPlay ? 'disabled' : ''}`}
                    onClick={() => track.canPlay && handlePlayTrack(track)}
                  >
                    <div className="track-number">
                      {isCurrentTrack(track) && isPlaying ? (
                        <div className="playing-indicator">
                          <div className="bar"></div>
                          <div className="bar"></div>
                          <div className="bar"></div>
                        </div>
                      ) : track.canPlay ? (
                        <>
                          <span className="track-index">{index + 1}</span>
                          <button className="track-play-btn">
                            <i className='bx bx-play' style={{ fontSize: '14px' }}></i>
                          </button>
                        </>
                      ) : (
                        <span className="track-index">{index + 1}</span>
                      )}
                    </div>

                    <div className="track-info">
                      <div className="track-main-info">
                        <div className="track-image">
                          <img
                            src={track.imageUrl || 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=60'}
                            alt={track.title}
                            onError={(e) => {
                              e.target.src = 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=60';
                            }}
                          />
                          {!track.canPlay && (
                            <div className="track-overlay">
                              <i className='bx bx-error-circle' style={{ fontSize: '16px' }}></i>
                            </div>
                          )}
                        </div>
                        <div className="track-details">
                          <div className="track-name">{track.title}</div>
                          <div className="track-artist">{track.artist}</div>
                          {!track.canPlay && (
                            <div className="track-status">Coming Soon</div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="track-album">{track.album || '—'}</div>

                    <div className="track-duration">
                      {formatDuration(track.duration)}
                    </div>

                    <div className="track-actions" style={{ opacity: isCurrentTrack(track) ? 1 : 0 }}>
                      <button
                        className={`action-btn ${isTrackLiked(track) ? 'liked' : ''}`}
                        onClick={(e) => handleLikeTrack(track, e)}
                        data-tooltip={isAuthenticated ? (isTrackLiked(track) ? 'Remove from liked songs' : 'Add to liked songs') : 'Sign in to like songs'}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill={isTrackLiked(track) ? "currentColor" : "none"}
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                        </svg>
                      </button>
                      <button
                        className={`action-btn ${isTrackInLibrary(track) ? 'in-library' : ''}`}
                        onClick={(e) => handleAddToLibrary(track, e)}
                        data-tooltip={isAuthenticated ? (isTrackInLibrary(track) ? 'Remove from library' : 'Add to library') : 'Sign in to add to library'}
                      >
                        <i className={`bx ${isTrackInLibrary(track) ? 'bx-check' : 'bx-plus'}`} style={{ fontSize: '16px' }}></i>
                      </button>
                      <button
                        className="action-btn"
                        onClick={(e) => handleAddToPlaylist(track, e)}
                        data-tooltip={isAuthenticated ? 'Add to playlist' : 'Sign in to add to playlist'}
                      >
                        <i className='bx bx-list-plus' style={{ fontSize: '16px' }}></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {showPagination && totalPages > 1 && (
              <div className="pagination">
                <button
                  className="pagination-btn"
                  onClick={() => onPageChange?.(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <i className='bx bx-chevron-left' style={{ fontSize: '16px', marginRight: '4px' }}></i>
                  Previous
                </button>

                <div className="pagination-info">
                  <span>Page {currentPage} of {totalPages}</span>
                </div>

                <div className="pagination-numbers">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <button
                        key={pageNum}
                        className={`pagination-number ${currentPage === pageNum ? 'active' : ''}`}
                        onClick={() => onPageChange?.(pageNum)}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  className="pagination-btn"
                  onClick={() => onPageChange?.(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <i className='bx bx-chevron-right' style={{ fontSize: '16px', marginLeft: '4px' }}></i>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <CreatePlaylistModal
        isOpen={showPlaylistModal}
        onClose={() => {
          setShowPlaylistModal(false);
          setSelectedSongForPlaylist(null);
        }}
        onPlaylistCreated={handlePlaylistCreated}
        selectedSong={selectedSongForPlaylist}
      />
    </>
  );
};

export default TrackList;