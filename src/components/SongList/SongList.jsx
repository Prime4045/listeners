import React, { useState } from 'react';
import {
    Play,
    Pause,
    Heart,
    MoreHorizontal,
    Clock,
    TrendingUp,
    Search,
    Filter,
    Grid,
    List
} from 'lucide-react';
import './SongList.css';

const SongList = ({
    songs = [],
    currentSong,
    isPlaying,
    onSongSelect,
    playHistory = []
}) => {
    const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('title'); // 'title', 'artist', 'playCount', 'duration'
    const [filterGenre, setFilterGenre] = useState('all');
    const [showFilters, setShowFilters] = useState(false);

    // Get unique genres for filter
    const genres = ['all', ...new Set(songs.map(song => song.genre).filter(Boolean))];

    // Filter and sort songs
    const filteredSongs = songs
        .filter(song => {
            const matchesSearch = !searchQuery ||
                song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                song.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
                song.album?.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesGenre = filterGenre === 'all' || song.genre === filterGenre;

            return matchesSearch && matchesGenre;
        })
        .sort((a, b) => {
            switch (sortBy) {
                case 'title':
                    return a.title.localeCompare(b.title);
                case 'artist':
                    return a.artist.localeCompare(b.artist);
                case 'playCount':
                    return (b.playCount || 0) - (a.playCount || 0);
                case 'duration':
                    return (a.duration || 0) - (b.duration || 0);
                default:
                    return 0;
            }
        });

    const formatDuration = (seconds) => {
        if (!seconds) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const formatPlayCount = (count) => {
        if (!count) return '0';
        if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
        if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
        return count.toString();
    };

    const isCurrentSong = (song) => currentSong?._id === song._id;
    const wasRecentlyPlayed = (song) => playHistory.some(item => item._id === song._id);

    const handleSongClick = (song) => {
        onSongSelect(song, filteredSongs);
    };

    const SongGridItem = ({ song }) => (
        <div
            className={`song-grid-item ${isCurrentSong(song) ? 'current' : ''}`}
            onClick={() => handleSongClick(song)}
        >
            <div className="song-grid-artwork">
                <img
                    src={song.albumArt || 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=300'}
                    alt={song.title}
                    onError={(e) => {
                        e.target.src = 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=300';
                    }}
                />
                <div className="song-grid-overlay">
                    <button className="grid-play-btn">
                        {isCurrentSong(song) && isPlaying ? (
                            <Pause className="w-6 h-6" />
                        ) : (
                            <Play className="w-6 h-6" />
                        )}
                    </button>
                </div>
                {wasRecentlyPlayed(song) && (
                    <div className="recently-played-indicator">
                        <Clock className="w-3 h-3" />
                    </div>
                )}
            </div>

            <div className="song-grid-info">
                <h3 className="song-grid-title">{song.title}</h3>
                <p className="song-grid-artist">{song.artist}</p>
                {song.playCount > 0 && (
                    <div className="song-grid-stats">
                        <TrendingUp className="w-3 h-3" />
                        <span>{formatPlayCount(song.playCount)}</span>
                    </div>
                )}
            </div>
        </div>
    );

    const SongListItem = ({ song, index }) => (
        <div
            className={`song-list-item ${isCurrentSong(song) ? 'current' : ''}`}
            onClick={() => handleSongClick(song)}
        >
            <div className="song-list-number">
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

            <div className="song-list-artwork">
                <img
                    src={song.albumArt || 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=50'}
                    alt={song.title}
                    onError={(e) => {
                        e.target.src = 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=50';
                    }}
                />
                {wasRecentlyPlayed(song) && (
                    <div className="recently-played-badge">
                        <Clock className="w-2 h-2" />
                    </div>
                )}
            </div>

            <div className="song-list-info">
                <div className="song-list-title">{song.title}</div>
                <div className="song-list-artist">{song.artist}</div>
            </div>

            <div className="song-list-album">{song.album || '—'}</div>

            <div className="song-list-stats">
                {song.playCount > 0 && (
                    <span className="play-count">{formatPlayCount(song.playCount)}</span>
                )}
            </div>

            <div className="song-list-duration">{formatDuration(song.duration)}</div>

            <div className="song-list-actions">
                <button className="song-action-btn" title="Like">
                    <Heart className="w-4 h-4" />
                </button>
                <button className="song-action-btn" title="More options">
                    <MoreHorizontal className="w-4 h-4" />
                </button>
            </div>
        </div>
    );

    return (
        <div className="song-list-container">
            {/* Header */}
            <div className="song-list-header">
                <div className="header-title">
                    <h2>Music Library</h2>
                    <span className="song-count">{filteredSongs.length} songs</span>
                </div>

                <div className="header-controls">
                    <div className="search-container">
                        <Search className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search songs, artists, albums..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="search-input"
                        />
                    </div>

                    <button
                        className={`filter-btn ${showFilters ? 'active' : ''}`}
                        onClick={() => setShowFilters(!showFilters)}
                        title="Filters"
                    >
                        <Filter className="w-4 h-4" />
                    </button>

                    <div className="view-toggle">
                        <button
                            className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
                            onClick={() => setViewMode('list')}
                            title="List view"
                        >
                            <List className="w-4 h-4" />
                        </button>
                        <button
                            className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                            onClick={() => setViewMode('grid')}
                            title="Grid view"
                        >
                            <Grid className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Filters */}
            {showFilters && (
                <div className="filters-panel">
                    <div className="filter-group">
                        <label>Sort by:</label>
                        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                            <option value="title">Title</option>
                            <option value="artist">Artist</option>
                            <option value="playCount">Play Count</option>
                            <option value="duration">Duration</option>
                        </select>
                    </div>

                    <div className="filter-group">
                        <label>Genre:</label>
                        <select value={filterGenre} onChange={(e) => setFilterGenre(e.target.value)}>
                            {genres.map(genre => (
                                <option key={genre} value={genre}>
                                    {genre === 'all' ? 'All Genres' : genre}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            {/* Song List */}
            <div className="song-list-content">
                {filteredSongs.length === 0 ? (
                    <div className="empty-state">
                        <Search className="w-12 h-12" />
                        <h3>No songs found</h3>
                        <p>Try adjusting your search or filters</p>
                    </div>
                ) : viewMode === 'grid' ? (
                    <div className="song-grid">
                        {filteredSongs.map((song) => (
                            <SongGridItem key={song._id} song={song} />
                        ))}
                    </div>
                ) : (
                    <div className="song-list">
                        <div className="song-list-header-row">
                            <div className="header-number">#</div>
                            <div className="header-artwork"></div>
                            <div className="header-info">Title</div>
                            <div className="header-album">Album</div>
                            <div className="header-stats">Plays</div>
                            <div className="header-duration">
                                <Clock className="w-4 h-4" />
                            </div>
                            <div className="header-actions"></div>
                        </div>

                        {filteredSongs.map((song, index) => (
                            <SongListItem key={song._id} song={song} index={index} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SongList;