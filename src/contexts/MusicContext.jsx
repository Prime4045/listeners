import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { Howl } from 'howler';
import ApiService from '../services/api';

const MusicContext = createContext({});

export const MusicProvider = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState(null);
  const [playlist, setPlaylist] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState('none'); // 'none', 'all', 'one'
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const howlRef = useRef(null);
  const intervalRef = useRef(null);

  // Load volume from localStorage
  useEffect(() => {
    const savedVolume = localStorage.getItem('playerVolume');
    if (savedVolume) {
      setVolume(parseFloat(savedVolume));
    }
  }, []);

  // Update current time
  const updateTime = useCallback(() => {
    if (howlRef.current && isPlaying) {
      const seek = howlRef.current.seek() || 0;
      setCurrentTime(seek);
    }
  }, [isPlaying]);

  // Start time update interval
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(updateTime, 1000);
    } else {
      clearInterval(intervalRef.current);
    }

    return () => clearInterval(intervalRef.current);
  }, [isPlaying, updateTime]);

  // Play track function
  const playTrack = useCallback(async (track, trackList = null) => {
    try {
      setError(null);
      setIsLoading(true);

      // If it's the same track, just toggle play/pause
      if (currentTrack?.spotifyId === track.spotifyId) {
        togglePlayPause();
        setIsLoading(false);
        return;
      }

      // Stop current track if playing
      if (howlRef.current) {
        howlRef.current.stop();
        howlRef.current.unload();
      }

      // Call API to play track (this stores it in database and gets audio URL)
      const songData = await ApiService.playTrack(track.spotifyId);

      // Set current track and playlist
      setCurrentTrack({
        ...track,
        audioUrl: songData.audioUrl,
        playCount: songData.playCount,
        likeCount: songData.likeCount,
      });

      if (trackList) {
        setPlaylist(trackList);
      }

      // Create new Howl instance with the audio URL from Google Cloud Storage
      howlRef.current = new Howl({
        src: [songData.audioUrl],
        html5: true,
        preload: true,
        volume: volume,
        onload: () => {
          setIsLoading(false);
          setDuration(howlRef.current.duration());
          setError(null);
        },
        onplay: () => {
          setIsPlaying(true);
          setError(null);
        },
        onpause: () => {
          setIsPlaying(false);
        },
        onstop: () => {
          setIsPlaying(false);
          setCurrentTime(0);
        },
        onend: () => {
          setIsPlaying(false);
          setCurrentTime(0);
          handleTrackEnd();
        },
        onloaderror: (id, error) => {
          setIsLoading(false);
          setError('Failed to load audio file');
          console.error('Audio load error:', error);
        },
        onplayerror: (id, error) => {
          setIsLoading(false);
          setError('Failed to play audio');
          console.error('Audio play error:', error);
        }
      });

      // Start playing
      setTimeout(() => {
        if (howlRef.current) {
          howlRef.current.play();
        }
      }, 100);

    } catch (err) {
      setIsLoading(false);
      setError(err.message || 'Failed to play track');
      console.error('Play track error:', err);
    }
  }, [currentTrack, volume]);

  // Handle track end
  const handleTrackEnd = useCallback(() => {
    if (repeatMode === 'one') {
      // Repeat current track
      if (howlRef.current) {
        howlRef.current.seek(0);
        howlRef.current.play();
      }
    } else {
      // Go to next track
      nextTrack();
    }
  }, [repeatMode]);

  // Toggle play/pause
  const togglePlayPause = useCallback(() => {
    if (!howlRef.current) return;

    if (isPlaying) {
      howlRef.current.pause();
    } else {
      howlRef.current.play();
    }
  }, [isPlaying]);

  // Previous track
  const previousTrack = useCallback(() => {
    if (!playlist.length || !currentTrack) return;

    const currentIndex = playlist.findIndex(track => track.spotifyId === currentTrack.spotifyId);
    if (currentIndex === -1) return;

    // If more than 3 seconds played, restart current track
    if (currentTime > 3) {
      seekTo(0);
      return;
    }

    let previousIndex;
    if (isShuffled) {
      // Random previous track
      do {
        previousIndex = Math.floor(Math.random() * playlist.length);
      } while (previousIndex === currentIndex && playlist.length > 1);
    } else {
      previousIndex = currentIndex === 0 ? playlist.length - 1 : currentIndex - 1;
    }

    const previousTrack = playlist[previousIndex];
    if (previousTrack) {
      playTrack(previousTrack, playlist);
    }
  }, [playlist, currentTrack, currentTime, isShuffled, playTrack]);

  // Next track
  const nextTrack = useCallback(() => {
    if (!playlist.length || !currentTrack) return;

    const currentIndex = playlist.findIndex(track => track.spotifyId === currentTrack.spotifyId);
    if (currentIndex === -1) return;

    let nextIndex;
    if (isShuffled) {
      // Random next track
      do {
        nextIndex = Math.floor(Math.random() * playlist.length);
      } while (nextIndex === currentIndex && playlist.length > 1);
    } else {
      nextIndex = (currentIndex + 1) % playlist.length;

      // If repeat mode is 'none' and we're at the end, stop
      if (repeatMode === 'none' && currentIndex === playlist.length - 1) {
        setIsPlaying(false);
        return;
      }
    }

    const nextTrack = playlist[nextIndex];
    if (nextTrack) {
      playTrack(nextTrack, playlist);
    }
  }, [playlist, currentTrack, isShuffled, repeatMode, playTrack]);

  // Seek to specific time
  const seekTo = useCallback((percentage) => {
    if (howlRef.current && duration) {
      const seekTime = (percentage / 100) * duration;
      howlRef.current.seek(seekTime);
      setCurrentTime(seekTime);
    }
  }, [duration]);

  // Change volume
  const changeVolume = useCallback((newVolume) => {
    setVolume(newVolume);
    if (howlRef.current) {
      howlRef.current.volume(newVolume);
    }
    localStorage.setItem('playerVolume', newVolume.toString());
  }, []);

  // Toggle shuffle
  const toggleShuffle = useCallback(() => {
    setIsShuffled(!isShuffled);
  }, [isShuffled]);

  // Toggle repeat
  const toggleRepeat = useCallback(() => {
    const modes = ['none', 'all', 'one'];
    const currentIndex = modes.indexOf(repeatMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setRepeatMode(modes[nextIndex]);
  }, [repeatMode]);

  // Format time helper
  const formatTime = useCallback((time) => {
    if (isNaN(time)) return '0:00';

    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (howlRef.current) {
        howlRef.current.unload();
      }
      clearInterval(intervalRef.current);
    };
  }, []);

  const value = {
    // State
    currentTrack,
    playlist,
    isPlaying,
    currentTime,
    duration,
    volume,
    isShuffled,
    repeatMode,
    isLoading,
    error,

    // Actions
    playTrack,
    togglePlayPause,
    previousTrack,
    nextTrack,
    seekTo,
    setVolume: changeVolume,
    toggleShuffle,
    toggleRepeat,

    // Helpers
    formatTime,

    // Progress percentage
    progress: duration > 0 ? (currentTime / duration) * 100 : 0,
  };

  return <MusicContext.Provider value={value}>{children}</MusicContext.Provider>;
};

export const useMusic = () => {
  const context = useContext(MusicContext);
  if (!context) {
    throw new Error('useMusic must be used within a MusicProvider');
  }
  return context;
};