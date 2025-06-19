import React, { useState, useEffect, useCallback } from 'react';
import AudioPlayer from '../AudioPlayer/AudioPlayer';
import PlaylistView from '../PlaylistView/PlaylistView';
import SongList from '../SongList/SongList';
import ApiService from '../../services/api';
import './MusicPlayer.css';

const MusicPlayer = () => {
    const [currentSong, setCurrentSong] = useState(null);
    const [playlist, setPlaylist] = useState([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [songs, setSongs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [playHistory, setPlayHistory] = useState([]);

    // Load songs on component mount
    useEffect(() => {
        loadSongs();
    }, []);

    const loadSongs = async () => {
        try {
            setLoading(true);
            setError(null);

            // For demo purposes, create sample songs
            const sampleSongs = [
                {
                    _id: '1',
                    title: 'Midnight Dreams',
                    artist: 'Luna Echo',
                    album: 'Nocturnal Vibes',
                    duration: 208,
                    songUrl: '/audio/sample1.mp3',
                    albumArt: 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=300',
                    genre: 'Electronic',
                    playCount: 1250
                },
                {
                    _id: '2',
                    title: 'Electric Pulse',
                    artist: 'Neon Waves',
                    album: 'Synthwave Collection',
                    duration: 252,
                    songUrl: '/audio/sample2.mp3',
                    albumArt: 'https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg?auto=compress&cs=tinysrgb&w=300',
                    genre: 'Synthwave',
                    playCount: 890
                },
                {
                    _id: '3',
                    title: 'Ocean Breeze',
                    artist: 'Coastal Sounds',
                    album: 'Natural Elements',
                    duration: 195,
                    songUrl: '/audio/sample3.mp3',
                    albumArt: 'https://images.pexels.com/photos/1190297/pexels-photo-1190297.jpeg?auto=compress&cs=tinysrgb&w=300',
                    genre: 'Ambient',
                    playCount: 2100
                },
                {
                    _id: '4',
                    title: 'Urban Rhythm',
                    artist: 'City Beats',
                    album: 'Metropolitan',
                    duration: 180,
                    songUrl: '/audio/sample4.mp3',
                    albumArt: 'https://images.pexels.com/photos/1644888/pexels-photo-1644888.jpeg?auto=compress&cs=tinysrgb&w=300',
                    genre: 'Hip Hop',
                    playCount: 3200
                },
                {
                    _id: '5',
                    title: 'Starlight Serenade',
                    artist: 'Cosmic Orchestra',
                    album: 'Celestial Harmonies',
                    duration: 240,
                    songUrl: '/audio/sample5.mp3',
                    albumArt: 'https://images.pexels.com/photos/1629236/pexels-photo-1629236.jpeg?auto=compress&cs=tinysrgb&w=300',
                    genre: 'Classical',
                    playCount: 1800
                }
            ];

            setSongs(sampleSongs);
            setPlaylist(sampleSongs);
        } catch (err) {
            console.error('Failed to load songs:', err);
            setError('Failed to load songs. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const playSong = useCallback(async (song, songList = null) => {
        try {
            setError(null);

            // Set the current song and playlist
            setCurrentSong(song);
            const activePlaylist = songList || playlist;
            setPlaylist(activePlaylist);

            // Find the index of the song in the playlist
            const index = activePlaylist.findIndex(s => s._id === song._id);
            setCurrentIndex(index);

            // Start playing
            setIsPlaying(true);

            // Record play in history (simulate API call)
            recordPlay(song);

        } catch (err) {
            console.error('Failed to play song:', err);
            setError('Failed to play song. Please try again.');
        }
    }, [playlist]);

    const recordPlay = async (song) => {
        try {
            // Add to local play history
            setPlayHistory(prev => {
                const newHistory = [
                    { ...song, playedAt: new Date() },
                    ...prev.filter(item => item._id !== song._id)
                ].slice(0, 10); // Keep only last 10 plays

                // Store in localStorage
                localStorage.setItem('playHistory', JSON.stringify(newHistory));
                return newHistory;
            });

            // In a real app, you would call the API here
            // await ApiService.post(`/songs/${song._id}/play`);

        } catch (err) {
            console.error('Failed to record play:', err);
        }
    };

    const handlePlayPause = () => {
        setIsPlaying(!isPlaying);
    };

    const handleNext = useCallback((specificSong = null) => {
        if (specificSong) {
            playSong(specificSong);
            return;
        }

        if (playlist.length === 0 || currentIndex === -1) return;

        const nextIndex = (currentIndex + 1) % playlist.length;
        const nextSong = playlist[nextIndex];

        if (nextSong) {
            playSong(nextSong);
        }
    }, [playlist, currentIndex, playSong]);

    const handlePrevious = useCallback(() => {
        if (playlist.length === 0 || currentIndex === -1) return;

        const prevIndex = currentIndex === 0 ? playlist.length - 1 : currentIndex - 1;
        const prevSong = playlist[prevIndex];

        if (prevSong) {
            playSong(prevSong);
        }
    }, [playlist, currentIndex, playSong]);

    const handleSongEnd = () => {
        // Auto-play next song
        handleNext();
    };

    const handleError = (errorMessage) => {
        setError(errorMessage);
        setIsPlaying(false);
    };

    const handleTimeUpdate = (currentTime, duration) => {
        // You can use this to update progress, save listening position, etc.
        // console.log('Time update:', currentTime, duration);
    };

    // Load play history from localStorage on mount
    useEffect(() => {
        const savedHistory = localStorage.getItem('playHistory');
        if (savedHistory) {
            try {
                setPlayHistory(JSON.parse(savedHistory));
            } catch (err) {
                console.error('Failed to parse play history:', err);
            }
        }
    }, []);

    // Keyboard controls
    useEffect(() => {
        const handleKeyPress = (e) => {
            // Only handle if not typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    handlePlayPause();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    handleNext();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    handlePrevious();
                    break;
                default:
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [handlePlayPause, handleNext, handlePrevious]);

    if (loading) {
        return (
            <div className="music-player-loading">
                <div className="loading-spinner"></div>
                <p>Loading music library...</p>
            </div>
        );
    }

    return (
        <div className="music-player-container">
            <div className="music-player-content">
                <div className="player-main">
                    <SongList
                        songs={songs}
                        currentSong={currentSong}
                        isPlaying={isPlaying}
                        onSongSelect={playSong}
                        playHistory={playHistory}
                    />
                </div>

                <div className="player-sidebar">
                    <PlaylistView
                        playlist={playlist}
                        currentSong={currentSong}
                        isPlaying={isPlaying}
                        onSongSelect={playSong}
                        onReorder={(fromIndex, toIndex) => {
                            const newPlaylist = [...playlist];
                            const [movedSong] = newPlaylist.splice(fromIndex, 1);
                            newPlaylist.splice(toIndex, 0, movedSong);
                            setPlaylist(newPlaylist);

                            // Update current index if needed
                            if (currentSong) {
                                const newIndex = newPlaylist.findIndex(s => s._id === currentSong._id);
                                setCurrentIndex(newIndex);
                            }
                        }}
                    />
                </div>
            </div>

            <AudioPlayer
                currentSong={currentSong}
                playlist={playlist}
                isPlaying={isPlaying}
                onPlayPause={handlePlayPause}
                onNext={handleNext}
                onPrevious={handlePrevious}
                onSongEnd={handleSongEnd}
                onError={handleError}
                onTimeUpdate={handleTimeUpdate}
                className="main-audio-player"
            />

            {error && (
                <div className="player-error">
                    <p>{error}</p>
                    <button onClick={() => setError(null)}>Dismiss</button>
                </div>
            )}
        </div>
    );
};

export default MusicPlayer;