import React, { useState, useRef, useEffect } from 'react';
import {
    Play,
    Pause,
    SkipBack,
    SkipForward,
    Volume2,
    VolumeX,
    Shuffle,
    Repeat,
    Loader2,
    AlertCircle,
    Minimize2,
    Maximize2,
    PictureInPicture2
} from 'lucide-react';
import { useMusic } from '../../contexts/MusicContext';
import { useAuth } from '../../contexts/AuthContext';
import AudioVisualizer from '../AudioVisualizer/AudioVisualizer';
import ApiService from '../../services/api';
import './MusicPlayer.css';

const MusicPlayer = ({ isMinimized = false, onToggleMinimize }) => {
    const { isAuthenticated } = useAuth();
    const {
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        volume,
        isShuffled,
        repeatMode,
        isLoading,
        error,
        togglePlayPause,
        previousTrack,
        nextTrack,
        seekTo,
        setVolume,
        toggleShuffle,
        toggleRepeat,
        formatTime,
        progress
    } = useMusic();

    const [isMuted, setIsMuted] = useState(false);
    const [isLiked, setIsLiked] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const progressRef = useRef(null);
    const volumeSliderRef = useRef(null);

    // Update muted state when volume changes
    useEffect(() => {
        setIsMuted(volume === 0);
    }, [volume]);

    // Update volume slider fill
    useEffect(() => {
        if (volumeSliderRef.current) {
            const percentage = (isMuted ? 0 : volume) * 100;
            volumeSliderRef.current.style.setProperty('--volume-percentage', `${percentage}%`);
        }
    }, [volume, isMuted]);

    // Check if current track is liked
    useEffect(() => {
        const checkLikedStatus = async () => {
            if (currentTrack && isAuthenticated) {
                try {
                    const trackDetails = await ApiService.getTrackDetails(currentTrack.spotifyId);
                    setIsLiked(trackDetails.isLiked || false);
                } catch (error) {
                    console.error('Failed to check liked status:', error);
                }
            } else {
                setIsLiked(false);
            }
        };

        checkLikedStatus();
    }, [currentTrack, isAuthenticated]);

    const handleVolumeChange = (e) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
    };

    const toggleMute = () => {
        if (isMuted || volume === 0) {
            setVolume(0.5);
        } else {
            setVolume(0);
        }
    };

    const handleProgressClick = (e) => {
        if (!progressRef.current || !duration) return;

        const rect = progressRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = (clickX / rect.width) * 100;
        seekTo(Math.max(0, Math.min(100, percentage)));
    };

    const handleProgressMouseDown = (e) => {
        setIsDragging(true);
        handleProgressClick(e);
    };

    const handleProgressMouseMove = (e) => {
        if (!isDragging) return;
        handleProgressClick(e);
    };

    const handleProgressMouseUp = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleProgressMouseMove);
            document.addEventListener('mouseup', handleProgressMouseUp);
            return () => {
                document.removeEventListener('mousemove', handleProgressMouseMove);
                document.removeEventListener('mouseup', handleProgressMouseUp);
            };
        }
    }, [isDragging]);

    const handleLikeToggle = async () => {
        if (!isAuthenticated) {
            return;
        }

        if (!currentTrack) {
            return;
        }

        try {
            await ApiService.likeTrack(currentTrack.spotifyId);
            setIsLiked(!isLiked);
            
            // Dispatch custom event to update dashboard
            window.dispatchEvent(new CustomEvent('liked_songs_updated'));
            
            // Also trigger storage event for cross-tab communication
            localStorage.setItem('liked_songs_updated', Date.now().toString());
            localStorage.removeItem('liked_songs_updated');
        } catch (error) {
            console.error('Failed to like/unlike track:', error);
        }
    };

    const getRepeatIcon = () => {
        if (repeatMode === 'one') {
            return (
                <div className="repeat-one">
                    <Repeat size={16} />
                    <span className="repeat-indicator">1</span>
                </div>
            );
        }
        return <Repeat size={16} />;
    };

    if (!currentTrack) {
        return (
            <div className="music-player no-track">
                <div className="no-track-content">
                    <div className="no-track-icon">
                        <Play size={24} />
                    </div>
                    <div className="no-track-text">
                        <h3>No song selected</h3>
                        <p>Choose a song to start playing</p>
                    </div>
                </div>
            </div>
        );
    }

    if (isMinimized) {
        return (
            <div className="music-player minimized">
                <div className="minimized-content">
                    <div className="minimized-track">
                        <img
                            src={currentTrack.imageUrl || 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=60'}
                            alt={currentTrack.title}
                            className="minimized-artwork"
                            onError={(e) => {
                                e.target.src = 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=60';
                            }}
                        />
                        <div className="minimized-info">
                            <div className="minimized-title">{currentTrack.title}</div>
                            <div className="minimized-artist">{currentTrack.artist}</div>
                            <PictureInPicture2
                                className="control-icon"
                                title="Picture in picture"
                            />
                        </div>
                    </div>

                    <div className="minimized-controls">
                        <button
                            className="control-btn"
                            onClick={previousTrack}
                            title="Previous track"
                        >
                            <SkipBack size={16} />
                        </button>
                        <button
                            className="play-pause-btn"
                            onClick={togglePlayPause}
                            disabled={isLoading}
                            title={isPlaying ? 'Pause' : 'Play'}
                        >
                            {isLoading ? (
                                <Loader2 className="animate-spin" size={16} />
                            ) : isPlaying ? (
                                <Pause size={16} />
                            ) : (
                                <Play size={16} />
                            )}
                        </button>
                        <button
                            className="control-btn"
                            onClick={nextTrack}
                            title="Next track"
                        >
                            <SkipForward size={16} />
                        </button>
                    </div>

                    {onToggleMinimize && (
                        <button
                            className="expand-btn"
                            onClick={onToggleMinimize}
                            title="Expand player"
                        >
                            <Maximize2 size={16} />
                        </button>
                    )}
                </div>

                <div className="minimized-progress">
                    <div
                        className="progress-bar"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="music-player">
            {error && (
                <div className="player-error">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                    <button onClick={() => window.location.reload()}>
                        Retry
                    </button>
                </div>
            )}

            <div className="player-content">
                {/* Track Info Section */}
                <div className="track-info">
                    <div className="track-artwork">
                        <img
                            src={currentTrack.imageUrl || 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=300'}
                            alt={currentTrack.title}
                            onError={(e) => {
                                e.target.src = 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=300';
                            }}
                        />
                        {isLoading && (
                            <div className="artwork-overlay">
                                <AlertCircle size={20} />
                            </div>
                        )}
                        
                        {/* Audio Visualizer Overlay */}
                        {isPlaying && (
                            <div className="visualizer-overlay">
                                <AudioVisualizer 
                                    type="bars" 
                                    size="small" 
                                    color="purple" 
                                    animated={true} 
                                />
                            </div>
                        )}
                    </div>

                    <div className="track-details">
                        <h3 className="track-title">{currentTrack.title}</h3>
                        <p className="track-artist">{currentTrack.artist}</p>
                    </div>

                    {/* Like Button */}
                    {isAuthenticated && (
                        <div className="track-actions">
                            <button
                                className={`action-btn like-btn ${isLiked ? 'liked' : ''}`}
                                onClick={handleLikeToggle}
                                title={isLiked ? 'Remove from liked songs' : 'Add to liked songs'}
                            >
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill={isLiked ? "currentColor" : "none"}
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                </svg>
                            </button>
                        </div>
                    )}
                </div>

                {/* Controls Section */}
                <div className="controls">
                    <div className="control-buttons">
                        <button
                            className={`control-btn ${isShuffled ? 'active' : ''}`}
                            onClick={toggleShuffle}
                            title="Enable shuffle"
                        >
                            <Shuffle size={16} />
                        </button>

                        <button
                            className="control-btn"
                            onClick={previousTrack}
                            title="Previous"
                        >
                            <SkipBack size={16} />
                        </button>

                        <button
                            className="play-pause-btn"
                            onClick={togglePlayPause}
                            disabled={isLoading}
                            title={isPlaying ? 'Pause' : 'Play'}
                        >
                            {isLoading ? (
                                <Loader2 className="animate-spin" size={16} />
                            ) : isPlaying ? (
                                <Pause size={16} />
                            ) : (
                                <Play size={16} />
                            )}
                        </button>

                        <button
                            className="control-btn"
                            onClick={nextTrack}
                            title="Next"
                        >
                            <SkipForward size={16} />
                        </button>

                        <button
                            className={`control-btn ${repeatMode !== 'none' ? 'active' : ''}`}
                            onClick={toggleRepeat}
                            title="Enable repeat"
                        >
                            {getRepeatIcon()}
                        </button>
                    </div>

                    <div className="progress-section">
                        <span className="time-display">{formatTime(currentTime)}</span>
                        <div
                            className="progress-container"
                            ref={progressRef}
                            onClick={handleProgressClick}
                            onMouseDown={handleProgressMouseDown}
                        >
                            <div className="progress-track">
                                <div
                                    className="progress-fill"
                                    style={{ width: `${progress}%` }}
                                />
                                <div
                                    className="progress-handle"
                                    style={{ left: `${progress}%` }}
                                />
                            </div>
                        </div>
                        <span className="time-display">{formatTime(duration)}</span>
                    </div>
                </div>

                {/* Volume Section */}
                <div className="volume-section">
                    <button
                        className="volume-btn"
                        onClick={toggleMute}
                        title="Mute"
                    >
                        {isMuted || volume === 0 ? (
                            <VolumeX size={16} />
                        ) : (
                            <Volume2 size={16} />
                        )}
                    </button>

                    <div className="volume-slider-container">
                        <input
                            ref={volumeSliderRef}
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={isMuted ? 0 : volume}
                            onChange={handleVolumeChange}
                            className="volume-slider"
                            title={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
                        />
                    </div>

                    <div className="additional-controls">
                        {onToggleMinimize && (
                            <Minimize2
                                className="control-icon"
                                onClick={onToggleMinimize}
                                title="Minimize player"
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MusicPlayer;