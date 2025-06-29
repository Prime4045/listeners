import React, { useState, useEffect } from 'react';
import { useMusic } from '../contexts/MusicContext';
import './TrackList.css';

// Define icons as React components to ensure they load properly
const PlayIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <polygon points="5,3 19,12 5,21" fill="currentColor" />
  </svg>
);

const PauseIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <rect x="6" y="4" width="4" height="16" fill="currentColor" />
    <rect x="14" y="4" width="4" height="16" fill="currentColor" />
  </svg>
);

const HeartIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="currentColor" strokeWidth="2" fill="none" />
  </svg>
);

const HeartFilledIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

const PlusIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2" />
    <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const CheckIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <polyline points="20,6 9,17 4,12" stroke="currentColor" strokeWidth="2" fill="none" />
  </svg>
);

const ListIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <line x1="8" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="2" />
    <line x1="8" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="2" />
    <line x1="8" y1="18" x2="21" y2="18" stroke="currentColor" strokeWidth="2" />
    <line x1="3" y1="6" x2="3.01" y2="6" stroke="currentColor" strokeWidth="2" />
    <line x1="3" y1="12" x2="3.01" y2="12" stroke="currentColor" strokeWidth="2" />
    <line x1="3" y1="18" x2="3.01" y2="18" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const MoreHorizontalIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <circle cx="12" cy="12" r="1" fill="currentColor" />
    <circle cx="19" cy="12" r="1" fill="currentColor" />
    <circle cx="5" cy="12" r="1" fill="currentColor" />
  </svg>
);

const ClockIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
    <polyline points="12,6 12,12 16,14" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const MusicIcon = ({ size = 48, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M9 18V5l12-2v13" stroke="currentColor" strokeWidth="2" fill="none" />
    <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="2" fill="none" />
    <circle cx="18" cy="16" r="3" stroke="currentColor" strokeWidth="2" fill="none" />
  </svg>
);

const AlertCircleIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
    <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" />
    <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const Loader2Icon = ({ size = 24, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M21 12a9 9 0 11-6.219-8.56" stroke="currentColor" strokeWidth="2" />
  </svg>
);

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
  isAuthenticated = false
}) => {
  const { currentTrack, isPlaying, playTrack } = useMusic();
  const [likedTracks, setLikedTracks] = useState(new Set());
  const [libraryTracks, setLibraryTracks] = useState(new Set());

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
    // TODO: Implement playlist modal
    console.log('Add to playlist:', track.title);
  };

  const isCurrentTrack = (track) => currentTrack?.spotifyId === track.spotifyId;
  const isTrackLiked = (track) => likedTracks.has(track.spotifyId);
  const isTrackInLibrary = (track) => libraryTracks.has(track.spotifyId);

  if (tracks.length === 0 && !isLoading) {
    return (
      <div className="track-list-empty">
        <MusicIcon size={48} />
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
    <div className="track-list-container">
      {isLoading && (
        <div className="track-list-loading">
          <Loader2Icon size={24} className="animate-spin" />
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
                <ClockIcon size={16} />
              </div>
              <div className="header-actions">Actions</div>
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
                          <PlayIcon size={14} />
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
                            <AlertCircleIcon size={16} />
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

                  <div className="track-actions">
                    <button
                      className={`action-btn ${isTrackLiked(track) ? 'liked' : ''}`}
                      onClick={(e) => handleLikeTrack(track, e)}
                      data-tooltip={isAuthenticated ? (isTrackLiked(track) ? 'Remove from liked songs' : 'Add to liked songs') : 'Sign in to like songs'}
                    >
                      {isTrackLiked(track) ? <HeartFilledIcon size={16} /> : <HeartIcon size={16} />}
                    </button>
                    <button
                      className={`action-btn ${isTrackInLibrary(track) ? 'in-library' : ''}`}
                      onClick={(e) => handleAddToLibrary(track, e)}
                      data-tooltip={isAuthenticated ? (isTrackInLibrary(track) ? 'Remove from library' : 'Add to library') : 'Sign in to add to library'}
                    >
                      {isTrackInLibrary(track) ? <CheckIcon size={16} /> : <PlusIcon size={16} />}
                    </button>
                    <button
                      className="action-btn"
                      onClick={(e) => handleAddToPlaylist(track, e)}
                      data-tooltip={isAuthenticated ? 'Add to playlist' : 'Sign in to add to playlist'}
                    >
                      <ListIcon size={16} />
                    </button>
                    <button className="action-btn" data-tooltip="More options">
                      <MoreHorizontalIcon size={16} />
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
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TrackList;