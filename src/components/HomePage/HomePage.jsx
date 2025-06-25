import React, { useState, useEffect } from 'react';
import {
    Play,
    Pause,
    SkipBack,
    SkipForward,
    Volume2,
    VolumeX,
    Heart,
    Shuffle,
    Repeat,
    TrendingUp,
    Music,
    Clock,
    Star,
    Loader2,
    AlertCircle
} from 'lucide-react';
import { useMusic } from '../../contexts/MusicContext';
import ApiService from '../../services/api';
import './HomePage.css';

const HomePage = () => {
    const [trendingSongs, setTrendingSongs] = useState([]);
    const [databaseSongs, setDatabaseSongs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const {
        currentTrack,
        isPlaying,
        playTrack,
        togglePlayPause,
        previousTrack,
        nextTrack,
        toggleShuffle,
        toggleRepeat,
        seekTo,
        setVolume,
        formatTime,
        currentTime,
        duration,
        progress,
        volume,
        isShuffled,
        repeatMode,
        isLoading: playerLoading,
        error: playerError,
    } = useMusic();

    useEffect(() => {
        loadHomePageData();
    }, []);

    const loadHomePageData = async () => {
        try {
            setLoading(true);
            setError(null);

            const [trendingResponse, databaseResponse] = await Promise.allSettled([
                ApiService.getTrendingSongs(12),
                ApiService.getDatabaseSongs(1, 12)
            ]);

            if (trendingResponse.status === 'fulfilled') {
                setTrendingSongs(trendingResponse.value || []);
            } else {
                console.error('Failed to load trending songs:', trendingResponse.reason);
            }

            if (databaseResponse.status === 'fulfilled') {
                setDatabaseSongs(databaseResponse.value?.songs || []);
            } else {
                console.error('Failed to load database songs:', databaseResponse.reason);
            }

            // If both requests failed, show error
            if (trendingResponse.status === 'rejected' && databaseResponse.status === 'rejected') {
                setError('Failed to load music data. Please try again later.');
            }
        } catch (err) {
            console.error('Failed to load home page data:', err);
            setError('Failed to load music data. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    const handleTrackSelect = async (track, trackList) => {
        try {
            setError(null);
            await playTrack(track, trackList);
        } catch (err) {
            console.error('Failed to play track:', err);
            setError(err.message || 'Failed to play track');
        }
    };

    const formatDuration = (ms) => {
        if (!ms) return '0:00';
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const MusicCard = ({ track, trackList, showPlayCount = false }) => (
        <div
            className={`music-card ${currentTrack?.spotifyId === track.spotifyId ? 'playing' : ''}`}
            onClick={() => track.canPlay && handleTrackSelect(track, trackList)}
            style={{ cursor: track.canPlay ? 'pointer' : 'not-allowed', opacity: track.canPlay ? 1 : 0.6 }}
        >
            <div className="card-image">
                <img
                    src={track.imageUrl || 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=300'}
                    alt={track.title}
                    onError={(e) => {
                        e.target.src = 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=300';
                    }}
                />
                <div className="card-overlay">
                    {track.canPlay ? (
                        <button className="play-btn">
                            {currentTrack?.spotifyId === track.spotifyId && isPlaying ? (
                                <Pause size={20} />
                            ) : (
                                <Play size={20} />
                            )}
                        </button>
                    ) : (
                        <div className="unavailable-indicator">
                            <AlertCircle size={20} />
                        </div>
                    )}
                </div>
            </div>
            <div className="card-content">
                <h3 className="card-title">{track.title}</h3>
                <p className="card-artist">{track.artist}</p>
                <div className="card-meta">
                    <span className="duration">{formatDuration(track.duration)}</span>
                    {showPlayCount && track.playCount > 0 && (
                        <span className="play-count">{track.playCount.toLocaleString()} plays</span>
                    )}
                </div>
                {!track.canPlay && (
                    <p className="unavailable-message">Coming Soon</p>
                )}
            </div>
        </div>
    );

    const MiniPlayer = () => {
        if (!currentTrack) return null;

        return (
            <div className="mini-player">
                <div className="mini-player-track">
                    <img
                        src={currentTrack.imageUrl || 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=50'}
                        alt={currentTrack.title}
                        className="mini-track-image"
                        onError={(e) => {
                            e.target.src = 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=50';
                        }}
                    />
                    <div className="mini-track-info">
                        <div className="mini-track-title">{currentTrack.title}</div>
                        <div className="mini-track-artist">{currentTrack.artist}</div>
                    </div>
                </div>

                <div className="mini-player-controls">
                    <button
                        className={`mini-control-btn ${isShuffled ? 'active' : ''}`}
                        onClick={toggleShuffle}
                        title="Shuffle"
                    >
                        <Shuffle size={16} />
                    </button>
                    <button className="mini-control-btn" onClick={previousTrack} title="Previous">
                        <SkipBack size={16} />
                    </button>
                    <button 
                        className="mini-play-btn" 
                        onClick={togglePlayPause} 
                        title={isPlaying ? 'Pause' : 'Play'}
                        disabled={playerLoading}
                    >
                        {playerLoading ? (
                            <Loader2 className="animate-spin" size={18} />
                        ) : isPlaying ? (
                            <Pause size={18} />
                        ) : (
                            <Play size={18} />
                        )}
                    </button>
                    <button className="mini-control-btn" onClick={nextTrack} title="Next">
                        <SkipForward size={16} />
                    </button>
                    <button
                        className={`mini-control-btn ${repeatMode !== 'none' ? 'active' : ''}`}
                        onClick={toggleRepeat}
                        title="Repeat"
                    >
                        <Repeat size={16} />
                    </button>
                </div>

                <div className="mini-player-progress">
                    <span className="time">{formatTime(currentTime)}</span>
                    <div
                        className="progress-bar"
                        onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const percent = (e.clientX - rect.left) / rect.width;
                            seekTo(percent * 100);
                        }}
                    >
                        <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                    </div>
                    <span className="time">{formatTime(duration)}</span>
                </div>

                <div className="mini-player-volume">
                    <button
                        className="volume-btn"
                        onClick={() => setVolume(volume === 0 ? 0.5 : 0)}
                        title={volume === 0 ? 'Unmute' : 'Mute'}
                    >
                        {volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    </button>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={volume}
                        onChange={(e) => setVolume(parseFloat(e.target.value))}
                        className="volume-slider"
                    />
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="home-page loading">
                <div className="loading-content">
                    <Loader2 className="loading-spinner" size={48} />
                    <h2>Loading your music...</h2>
                    <p>Discovering the best tracks for you</p>
                </div>
            </div>
        );
    }

    return (
        <div className="home-page">
            {/* Hero Section */}
            <section className="hero-section">
                <div className="hero-content">
                    <h1 className="hero-title">
                        Discover Your Next
                        <span className="gradient-text"> Favorite Song</span>
                    </h1>
                    <p className="hero-subtitle">
                        Stream millions of songs with high-quality audio from our curated library
                    </p>
                    {currentTrack && (
                        <div className="hero-player">
                            <MiniPlayer />
                        </div>
                    )}
                </div>
                <div className="hero-background">
                    <div className="hero-gradient"></div>
                </div>
            </section>

            {/* Error Display */}
            {(error || playerError) && (
                <div className="error-banner">
                    <AlertCircle size={20} />
                    <p>{error || playerError}</p>
                    <button onClick={loadHomePageData} className="retry-btn">
                        Try Again
                    </button>
                </div>
            )}

            {/* Trending Songs Section */}
            {trendingSongs.length > 0 && (
                <section className="music-section">
                    <div className="section-header">
                        <div className="section-title">
                            <TrendingUp className="section-icon" />
                            <h2>Trending Now</h2>
                        </div>
                        <div className="section-subtitle">
                            Most popular tracks from Spotify
                        </div>
                    </div>
                    <div className="music-grid">
                        {trendingSongs.map((track) => (
                            <MusicCard
                                key={track.spotifyId}
                                track={track}
                                trackList={trendingSongs}
                                showPlayCount={true}
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* Available Songs Section */}
            {databaseSongs.length > 0 && (
                <section className="music-section">
                    <div className="section-header">
                        <div className="section-title">
                            <Music className="section-icon" />
                            <h2>Available Songs</h2>
                        </div>
                        <div className="section-subtitle">
                            Ready to play from our library
                        </div>
                    </div>
                    <div className="music-grid">
                        {databaseSongs.map((track) => (
                            <MusicCard
                                key={track.spotifyId}
                                track={track}
                                trackList={databaseSongs}
                                showPlayCount={true}
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* Featured Player Section */}
            {currentTrack && (
                <section className="featured-player-section">
                    <div className="featured-player">
                        <div className="player-artwork">
                            <img
                                src={currentTrack.imageUrl || 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=400'}
                                alt={currentTrack.title}
                                onError={(e) => {
                                    e.target.src = 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=400';
                                }}
                            />
                            <div className="artwork-overlay">
                                <button 
                                    className="featured-play-btn" 
                                    onClick={togglePlayPause}
                                    disabled={playerLoading}
                                >
                                    {playerLoading ? (
                                        <Loader2 className="animate-spin" size={32} />
                                    ) : isPlaying ? (
                                        <Pause size={32} />
                                    ) : (
                                        <Play size={32} />
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="player-details">
                            <div className="track-info">
                                <h3 className="track-title">{currentTrack.title}</h3>
                                <p className="track-artist">{currentTrack.artist}</p>
                                <p className="track-album">{currentTrack.album}</p>
                            </div>

                            <div className="player-controls">
                                <div className="control-buttons">
                                    <button
                                        className={`control-btn ${isShuffled ? 'active' : ''}`}
                                        onClick={toggleShuffle}
                                    >
                                        <Shuffle size={20} />
                                    </button>
                                    <button className="control-btn" onClick={previousTrack}>
                                        <SkipBack size={20} />
                                    </button>
                                    <button 
                                        className="main-play-btn" 
                                        onClick={togglePlayPause}
                                        disabled={playerLoading}
                                    >
                                        {playerLoading ? (
                                            <Loader2 className="animate-spin" size={24} />
                                        ) : isPlaying ? (
                                            <Pause size={24} />
                                        ) : (
                                            <Play size={24} />
                                        )}
                                    </button>
                                    <button className="control-btn" onClick={nextTrack}>
                                        <SkipForward size={20} />
                                    </button>
                                    <button
                                        className={`control-btn ${repeatMode !== 'none' ? 'active' : ''}`}
                                        onClick={toggleRepeat}
                                    >
                                        <Repeat size={20} />
                                    </button>
                                </div>

                                <div className="progress-section">
                                    <span className="time-display">{formatTime(currentTime)}</span>
                                    <div
                                        className="progress-container"
                                        onClick={(e) => {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const percent = (e.clientX - rect.left) / rect.width;
                                            seekTo(percent * 100);
                                        }}
                                    >
                                        <div className="progress-track">
                                            <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                                        </div>
                                    </div>
                                    <span className="time-display">{formatTime(duration)}</span>
                                </div>

                                <div className="volume-section">
                                    <button
                                        className="volume-btn"
                                        onClick={() => setVolume(volume === 0 ? 0.5 : 0)}
                                    >
                                        {volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                                    </button>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.01"
                                        value={volume}
                                        onChange={(e) => setVolume(parseFloat(e.target.value))}
                                        className="volume-range"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
};

export default HomePage;