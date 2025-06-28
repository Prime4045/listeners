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
    Heart,
    MoreHorizontal,
    Loader2,
    AlertCircle,
    Minimize2,
    Maximize2
} from 'lucide-react';
import { useMusic } from '../../contexts/MusicContext';
import { useAuth } from '../../contexts/AuthContext';
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

    // Update muted state when volume changes
    useEffect(() => {
        setIsMuted(volume === 0);
    }, [volume]);

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

    const handleLikeToggle = () => {
        if (!isAuthenticated) {
            // Show auth modal or redirect to login
            return;
        }
        setIsLiked(!isLiked);
        // TODO: Implement API call to like/unlike track
    };

    const getRepeatIcon = () => {
        if (repeatMode === 'one') {
            return (
                <div className="repeat-one">
                    <Repeat size={18} />
                    <span className="repeat-indicator">1</span>
                </div>
            );
        }
        return <Repeat size={18} />;
    };

    if (!currentTrack) {
        return (
            <div className={`music-player no-track ${isMinimized ? 'minimized' : ''}`}>
                <div className="no-track-content">
                    <div className="no-track-icon">
                        <Play size={28} />
                    </div>
                    <div className="no-track-text">
                        <h3>No song selected</h3>
                        <p>Choose a song to start your musical journey</p>
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
                        </div>
                    </div>

                    <div className="minimized-controls">
                        <button 
                            className="control-btn" 
                            onClick={previousTrack}
                            title="Previous track"
                        >
                            <SkipBack size={18} />
                        </button>
                        <button
                            className="play-pause-btn"
                            onClick={togglePlayPause}
                            disabled={isLoading}
                            title={isPlaying ? 'Pause' : 'Play'}
                        >
                            {isLoading ? (
                                <Loader2 className="animate-spin" size={20} />
                            ) : isPlaying ? (
                                <Pause size={20} />
                            ) : (
                                <Play size={20} />
                            )}
                        </button>
                        <button 
                            className="control-btn" 
                            onClick={nextTrack}
                            title="Next track"
                        >
                            <SkipForward size={18} />
                        </button>
                    </div>

                    {onToggleMinimize && (
                        <button 
                            className="expand-btn" 
                            onClick={onToggleMinimize}
                            title="Expand player"
                        >
                            <Maximize2 size={18} />
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
                    <AlertCircle size={18} />
                    <span>{error}</span>
                    <button onClick={() => window.location.reload()}>
                        Retry
                    </button>
                </div>
            )}

            <div className="player-content">
                {/* Track Info */}
                <div className="player-section track-info">
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
                                <Loader2 className="animate-spin" size={28} />
                            </div>
                        )}
                    </div>

                    <div className="track-details">
                        <h3 className="track-title">{currentTrack.title}</h3>
                        <p className="track-artist">{currentTrack.artist}</p>
                        {currentTrack.album && (
                            <p className="track-album">{currentTrack.album}</p>
                        )}
                    </div>

                    <div className="track-actions">
                        <button
                            className={`action-btn like-btn ${isLiked ? 'liked' : ''}`}
                            onClick={handleLikeToggle}
                            title={isAuthenticated ? 'Like song' : 'Sign in to like songs'}
                        >
                            <Heart size={18} />
                        </button>
                        <button 
                            className="action-btn" 
                            title="More options"
                        >
                            <MoreHorizontal size={18} />
                        </button>
                        {onToggleMinimize && (
                            <button 
                                className="action-btn minimize-btn" 
                                onClick={onToggleMinimize}
                                title="Minimize player"
                            >
                                <Minimize2 size={18} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Controls */}
                <div className="player-section controls">
                    <div className="control-buttons">
                        <button
                            className={`control-btn ${isShuffled ? 'active' : ''}`}
                            onClick={toggleShuffle}
                            title="Shuffle"
                        >
                            <Shuffle size={18} />
                        </button>

                        <button 
                            className="control-btn" 
                            onClick={previousTrack} 
                            title="Previous track"
                        >
                            <SkipBack size={22} />
                        </button>

                        <button
                            className="play-pause-btn"
                            onClick={togglePlayPause}
                            disabled={isLoading}
                            title={isPlaying ? 'Pause' : 'Play'}
                        >
                            {isLoading ? (
                                <Loader2 className="animate-spin" size={28} />
                            ) : isPlaying ? (
                                <Pause size={28} />
                            ) : (
                                <Play size={28} />
                            )}
                        </button>

                        <button 
                            className="control-btn" 
                            onClick={nextTrack} 
                            title="Next track"
                        >
                            <SkipForward size={22} />
                        </button>

                        <button
                            className={`control-btn ${repeatMode !== 'none' ? 'active' : ''}`}
                            onClick={toggleRepeat}
                            title={`Repeat: ${repeatMode}`}
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

                {/* Volume */}
                <div className="player-section volume-section">
                    <button
                        className="volume-btn"
                        onClick={toggleMute}
                        title={isMuted ? 'Unmute' : 'Mute'}
                    >
                        {isMuted || volume === 0 ? (
                            <VolumeX size={18} />
                        ) : (
                            <Volume2 size={18} />
                        )}
                    </button>

                    <div className="volume-slider-container">
                        <input
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
                </div>
            </div>
        </div>
    );
};

// Export as default
export default MusicPlayer;