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
    AlertCircle
} from 'lucide-react';
import './AudioPlayer.css';

const AudioPlayer = ({
    currentSong,
    playlist = [],
    isPlaying,
    onPlayPause,
    onNext,
    onPrevious,
    onSongEnd,
    onError,
    onTimeUpdate,
    className = ''
}) => {
    const audioRef = useRef(null);
    const progressRef = useRef(null);

    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(0.8);
    const [isMuted, setIsMuted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isShuffled, setIsShuffled] = useState(false);
    const [repeatMode, setRepeatMode] = useState('none'); // none, one, all
    const [isLiked, setIsLiked] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    // Initialize audio element
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleLoadStart = () => {
            setIsLoading(true);
            setError(null);
        };

        const handleLoadedMetadata = () => {
            setDuration(audio.duration);
            setIsLoading(false);
        };

        const handleTimeUpdate = () => {
            if (!isDragging) {
                setCurrentTime(audio.currentTime);
                onTimeUpdate?.(audio.currentTime, audio.duration);
            }
        };

        const handleEnded = () => {
            handleSongEnd();
        };

        const handleError = (e) => {
            setIsLoading(false);
            const errorMessage = getAudioErrorMessage(e.target.error);
            setError(errorMessage);
            onError?.(errorMessage);
        };

        const handleCanPlay = () => {
            setIsLoading(false);
            setError(null);
        };

        const handleWaiting = () => {
            setIsLoading(true);
        };

        const handleCanPlayThrough = () => {
            setIsLoading(false);
        };

        // Add event listeners
        audio.addEventListener('loadstart', handleLoadStart);
        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('error', handleError);
        audio.addEventListener('canplay', handleCanPlay);
        audio.addEventListener('waiting', handleWaiting);
        audio.addEventListener('canplaythrough', handleCanPlayThrough);

        return () => {
            audio.removeEventListener('loadstart', handleLoadStart);
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('error', handleError);
            audio.removeEventListener('canplay', handleCanPlay);
            audio.removeEventListener('waiting', handleWaiting);
            audio.removeEventListener('canplaythrough', handleCanPlayThrough);
        };
    }, [isDragging, onTimeUpdate, onError]);

    // Handle song changes
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || !currentSong?.songUrl) return;

        setError(null);
        setCurrentTime(0);
        setDuration(0);

        audio.src = currentSong.songUrl;
        audio.load();
    }, [currentSong?.songUrl]);

    // Handle play/pause state changes
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        if (isPlaying && !error) {
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.error('Playback failed:', error);
                    setError('Playback failed. Please try again.');
                    onError?.('Playback failed');
                });
            }
        } else {
            audio.pause();
        }
    }, [isPlaying, error, onError]);

    // Handle volume changes
    useEffect(() => {
        const audio = audioRef.current;
        if (audio) {
            audio.volume = isMuted ? 0 : volume;
        }
    }, [volume, isMuted]);

    const getAudioErrorMessage = (error) => {
        if (!error) return 'Unknown audio error';

        switch (error.code) {
            case error.MEDIA_ERR_ABORTED:
                return 'Audio playback was aborted';
            case error.MEDIA_ERR_NETWORK:
                return 'Network error occurred while loading audio';
            case error.MEDIA_ERR_DECODE:
                return 'Audio file is corrupted or unsupported';
            case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                return 'Audio format not supported';
            default:
                return 'Failed to load audio file';
        }
    };

    const handleSongEnd = () => {
        if (repeatMode === 'one') {
            // Repeat current song
            audioRef.current.currentTime = 0;
            audioRef.current.play();
        } else if (repeatMode === 'all' || playlist.length > 1) {
            // Go to next song
            handleNext();
        } else {
            // Stop playback
            onSongEnd?.();
        }
    };

    const handlePlayPause = () => {
        if (error) {
            // Retry loading the song
            setError(null);
            if (audioRef.current) {
                audioRef.current.load();
            }
        } else {
            onPlayPause?.();
        }
    };

    const handleNext = () => {
        if (playlist.length <= 1) return;

        if (isShuffled) {
            // Random next song
            const currentIndex = playlist.findIndex(song => song._id === currentSong?._id);
            let randomIndex;
            do {
                randomIndex = Math.floor(Math.random() * playlist.length);
            } while (randomIndex === currentIndex && playlist.length > 1);

            onNext?.(playlist[randomIndex]);
        } else {
            onNext?.();
        }
    };

    const handlePrevious = () => {
        if (playlist.length <= 1) return;

        // If more than 3 seconds played, restart current song
        if (currentTime > 3) {
            audioRef.current.currentTime = 0;
        } else {
            onPrevious?.();
        }
    };

    const handleProgressClick = (e) => {
        const audio = audioRef.current;
        const progressBar = progressRef.current;
        if (!audio || !progressBar || !duration) return;

        const rect = progressBar.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const newTime = (clickX / rect.width) * duration;

        audio.currentTime = newTime;
        setCurrentTime(newTime);
    };

    const handleProgressDrag = (e) => {
        if (!isDragging) return;

        const audio = audioRef.current;
        const progressBar = progressRef.current;
        if (!audio || !progressBar || !duration) return;

        const rect = progressBar.getBoundingClientRect();
        const dragX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const newTime = (dragX / rect.width) * duration;

        audio.currentTime = newTime;
        setCurrentTime(newTime);
    };

    const handleVolumeChange = (e) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
        setIsMuted(newVolume === 0);
    };

    const toggleMute = () => {
        setIsMuted(!isMuted);
    };

    const toggleShuffle = () => {
        setIsShuffled(!isShuffled);
    };

    const toggleRepeat = () => {
        const modes = ['none', 'all', 'one'];
        const currentIndex = modes.indexOf(repeatMode);
        const nextIndex = (currentIndex + 1) % modes.length;
        setRepeatMode(modes[nextIndex]);
    };

    const toggleLike = () => {
        setIsLiked(!isLiked);
        // TODO: Implement like functionality with API
    };

    const formatTime = (time) => {
        if (isNaN(time)) return '0:00';
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const getRepeatIcon = () => {
        if (repeatMode === 'one') {
            return <Repeat className="w-4 h-4" />;
        }
        return <Repeat className="w-4 h-4" />;
    };

    if (!currentSong) {
        return (
            <div className={`audio-player no-song ${className}`}>
                <div className="player-message">
                    <div className="message-content">
                        <div className="message-icon">
                            <Play className="w-8 h-8" />
                        </div>
                        <h3>No song selected</h3>
                        <p>Choose a song to start playing</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`audio-player ${className}`}>
            <audio
                ref={audioRef}
                preload="metadata"
                crossOrigin="anonymous"
            />

            {/* Song Info Section */}
            <div className="player-section song-info">
                <div className="song-artwork">
                    <img
                        src={currentSong.albumArt || 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=100'}
                        alt={currentSong.title}
                        onError={(e) => {
                            e.target.src = 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=100';
                        }}
                    />
                    {isLoading && (
                        <div className="artwork-overlay">
                            <Loader2 className="w-6 h-6 animate-spin" />
                        </div>
                    )}
                </div>

                <div className="song-details">
                    <h3 className="song-title">{currentSong.title}</h3>
                    <p className="song-artist">{currentSong.artist}</p>
                    {currentSong.album && (
                        <p className="song-album">{currentSong.album}</p>
                    )}
                </div>

                <div className="song-actions">
                    <button
                        className={`action-btn like-btn ${isLiked ? 'liked' : ''}`}
                        onClick={toggleLike}
                        title={isLiked ? 'Remove from liked songs' : 'Add to liked songs'}
                    >
                        <Heart className="w-4 h-4" />
                    </button>
                    <button className="action-btn" title="More options">
                        <MoreHorizontal className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Controls Section */}
            <div className="player-section controls">
                <div className="control-buttons">
                    <button
                        className={`control-btn shuffle-btn ${isShuffled ? 'active' : ''}`}
                        onClick={toggleShuffle}
                        disabled={playlist.length <= 1}
                        title="Shuffle"
                    >
                        <Shuffle className="w-4 h-4" />
                    </button>

                    <button
                        className="control-btn"
                        onClick={handlePrevious}
                        disabled={playlist.length <= 1}
                        title="Previous"
                    >
                        <SkipBack className="w-5 h-5" />
                    </button>

                    <button
                        className="play-pause-btn"
                        onClick={handlePlayPause}
                        disabled={!currentSong?.songUrl}
                        title={error ? 'Retry' : isPlaying ? 'Pause' : 'Play'}
                    >
                        {isLoading ? (
                            <Loader2 className="w-6 h-6 animate-spin" />
                        ) : error ? (
                            <AlertCircle className="w-6 h-6" />
                        ) : isPlaying ? (
                            <Pause className="w-6 h-6" />
                        ) : (
                            <Play className="w-6 h-6" />
                        )}
                    </button>

                    <button
                        className="control-btn"
                        onClick={handleNext}
                        disabled={playlist.length <= 1}
                        title="Next"
                    >
                        <SkipForward className="w-5 h-5" />
                    </button>

                    <button
                        className={`control-btn repeat-btn ${repeatMode !== 'none' ? 'active' : ''}`}
                        onClick={toggleRepeat}
                        title={`Repeat: ${repeatMode}`}
                    >
                        {getRepeatIcon()}
                        {repeatMode === 'one' && <span className="repeat-indicator">1</span>}
                    </button>
                </div>

                <div className="progress-section">
                    <span className="time-display">{formatTime(currentTime)}</span>

                    <div
                        className="progress-container"
                        ref={progressRef}
                        onClick={handleProgressClick}
                        onMouseDown={() => setIsDragging(true)}
                        onMouseUp={() => setIsDragging(false)}
                        onMouseMove={handleProgressDrag}
                    >
                        <div className="progress-bar">
                            <div
                                className="progress-fill"
                                style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                            />
                            <div
                                className="progress-handle"
                                style={{ left: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                            />
                        </div>
                    </div>

                    <span className="time-display">{formatTime(duration)}</span>
                </div>
            </div>

            {/* Volume Section */}
            <div className="player-section volume-section">
                <button
                    className="volume-btn"
                    onClick={toggleMute}
                    title={isMuted ? 'Unmute' : 'Mute'}
                >
                    {isMuted || volume === 0 ? (
                        <VolumeX className="w-4 h-4" />
                    ) : (
                        <Volume2 className="w-4 h-4" />
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
                    />
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="error-display">
                    <AlertCircle className="w-4 h-4" />
                    <span>{error}</span>
                    <button
                        className="retry-btn"
                        onClick={() => {
                            setError(null);
                            if (audioRef.current) {
                                audioRef.current.load();
                            }
                        }}
                    >
                        Retry
                    </button>
                </div>
            )}
        </div>
    );
};

export default AudioPlayer;