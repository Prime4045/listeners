import React, { useState } from 'react';
import {
    Play,
    Pause,
    MoreHorizontal,
    Clock,
    Shuffle,
    Heart,
    Download,
    Share,
    Edit3,
    Trash2
} from 'lucide-react';
import './PlaylistView.css';

const PlaylistView = ({
    playlist = [],
    currentSong,
    isPlaying,
    onSongSelect,
    onReorder
}) => {
    const [draggedIndex, setDraggedIndex] = useState(null);
    const [dragOverIndex, setDragOverIndex] = useState(null);

    const formatDuration = (seconds) => {
        if (!seconds) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const getTotalDuration = () => {
        return playlist.reduce((total, song) => total + (song.duration || 0), 0);
    };

    const formatTotalDuration = () => {
        const total = getTotalDuration();
        const hours = Math.floor(total / 3600);
        const minutes = Math.floor((total % 3600) / 60);

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    };

    const isCurrentSong = (song) => currentSong?._id === song._id;

    const handleDragStart = (e, index) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverIndex(index);
    };

    const handleDragLeave = () => {
        setDragOverIndex(null);
    };

    const handleDrop = (e, dropIndex) => {
        e.preventDefault();

        if (draggedIndex !== null && draggedIndex !== dropIndex) {
            onReorder?.(draggedIndex, dropIndex);
        }

        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    const playAllSongs = () => {
        if (playlist.length > 0) {
            onSongSelect(playlist[0], playlist);
        }
    };

    const shufflePlay = () => {
        if (playlist.length > 0) {
            const randomIndex = Math.floor(Math.random() * playlist.length);
            onSongSelect(playlist[randomIndex], playlist);
        }
    };

    if (playlist.length === 0) {
        return (
            <div className="playlist-view empty">
                <div className="empty-playlist">
                    <div className="empty-icon">
                        <Play className="w-12 h-12" />
                    </div>
                    <h3>No songs in queue</h3>
                    <p>Add songs to start building your playlist</p>
                </div>
            </div>
        );
    }

    return (
        <div className="playlist-view">
            {/* Playlist Header */}
            <div className="playlist-header">
                <div className="playlist-info">
                    <h2>Now Playing</h2>
                    <div className="playlist-stats">
                        <span>{playlist.length} songs</span>
                        <span>•</span>
                        <span>{formatTotalDuration()}</span>
                    </div>
                </div>

                <div className="playlist-actions">
                    <button
                        className="action-btn primary"
                        onClick={playAllSongs}
                        title="Play all"
                    >
                        <Play className="w-4 h-4" />
                    </button>

                    <button
                        className="action-btn"
                        onClick={shufflePlay}
                        title="Shuffle play"
                    >
                        <Shuffle className="w-4 h-4" />
                    </button>

                    <button className="action-btn" title="More options">
                        <MoreHorizontal className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Playlist Content */}
            <div className="playlist-content">
                <div className="playlist-songs">
                    {playlist.map((song, index) => (
                        <div
                            key={`${song._id}-${index}`}
                            className={`playlist-song ${isCurrentSong(song) ? 'current' : ''} ${draggedIndex === index ? 'dragging' : ''
                                } ${dragOverIndex === index ? 'drag-over' : ''}`}
                            draggable
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, index)}
                            onDragEnd={handleDragEnd}
                            onClick={() => onSongSelect(song, playlist)}
                        >
                            <div className="song-drag-handle">
                                <div className="drag-dots">
                                    <div className="dot"></div>
                                    <div className="dot"></div>
                                    <div className="dot"></div>
                                    <div className="dot"></div>
                                    <div className="dot"></div>
                                    <div className="dot"></div>
                                </div>
                            </div>

                            <div className="song-number">
                                {isCurrentSong(song) && isPlaying ? (
                                    <div className="playing-indicator">
                                        <div className="bar"></div>
                                        <div className="bar"></div>
                                        <div className="bar"></div>
                                    </div>
                                ) : (
                                    <span>{index + 1}</span>
                                )}
                            </div>

                            <div className="song-artwork">
                                <img
                                    src={song.albumArt || 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=50'}
                                    alt={song.title}
                                    onError={(e) => {
                                        e.target.src = 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=50';
                                    }}
                                />

                                <div className="song-overlay">
                                    <button className="overlay-play-btn">
                                        {isCurrentSong(song) && isPlaying ? (
                                            <Pause className="w-3 h-3" />
                                        ) : (
                                            <Play className="w-3 h-3" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            <div className="song-details">
                                <div className="song-title">{song.title}</div>
                                <div className="song-artist">{song.artist}</div>
                            </div>

                            <div className="song-duration">
                                {formatDuration(song.duration)}
                            </div>

                            <div className="song-actions">
                                <button className="song-action-btn" title="Like">
                                    <Heart className="w-3 h-3" />
                                </button>
                                <button className="song-action-btn" title="Remove from playlist">
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Playlist Footer */}
            <div className="playlist-footer">
                <div className="footer-actions">
                    <button className="footer-btn" title="Save playlist">
                        <Heart className="w-4 h-4" />
                        <span>Save</span>
                    </button>

                    <button className="footer-btn" title="Download playlist">
                        <Download className="w-4 h-4" />
                        <span>Download</span>
                    </button>

                    <button className="footer-btn" title="Share playlist">
                        <Share className="w-4 h-4" />
                        <span>Share</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PlaylistView;