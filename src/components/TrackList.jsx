import React, { useState } from 'react';
import {
  Play,
  Pause,
  Heart,
  Plus,
  MoreHorizontal,
  Clock,
  Music,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useMusic } from '../contexts/MusicContext';
import './TrackList.css';

const TrackList = ({
  tracks = [],
  onAuthRequired,
  showPagination = false,
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  isLoading = false,
  searchQuery = ''
}) => {
  const { isAuthenticated } = useAuth();
  const { currentTrack, isPlaying, playTrack } = useMusic();
  const [likedTracks, setLikedTracks] = useState(new Set());

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

  const handleLikeTrack = (track, e) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      onAuthRequired?.();
      return;
    }

    // Toggle like status
    const newLikedTracks = new Set(likedTracks);
    if (likedTracks.has(track.spotifyId)) {
      newLikedTracks.delete(track.spotifyId);
    } else {
      newLikedTracks.add(track.spotifyId);
    }
    setLikedTracks(newLikedTracks);
  };

  const handleAddToLibrary = (track, e) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      onAuthRequired?.();
      return;
    }
    // Add to library logic here
    console.log('Add to library:', track.title);
  };

  const isCurrentTrack = (track) => currentTrack?.spotifyId === track.spotifyId;
  const isTrackLiked = (track) => likedTracks.has(track.spotifyId);

  if (tracks.length === 0 && !isLoading) {
    return (
      <div className="track-list-empty">
        <Music size={48} />
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
          <Loader2 className="animate-spin" size={24} />
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
                <Clock size={16} />
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
                      <button className="track-play-btn">
                        <Play size={12} />
                      </button>
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
                            <AlertCircle size={16} />
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
                      className={`action-btn like-btn ${isTrackLiked(track) ? 'liked' : ''}`}
                      onClick={(e) => handleLikeTrack(track, e)}
                      title={isAuthenticated ? 'Like song' : 'Sign in to like songs'}
                    >
                      <Heart size={16} />
                    </button>
                    <button
                      className="action-btn"
                      onClick={(e) => handleAddToLibrary(track, e)}
                      title={isAuthenticated ? 'Add to library' : 'Sign in to add to library'}
                    >
                      <Plus size={16} />
                    </button>
                    <button className="action-btn" title="More options">
                      <MoreHorizontal size={16} />
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