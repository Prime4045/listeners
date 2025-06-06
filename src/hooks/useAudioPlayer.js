import { useState, useEffect, useRef, useCallback } from 'react';
import { Howl } from 'howler';

export const useAudioPlayer = () => {
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const howlRef = useRef(null);
  const intervalRef = useRef(null);

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

  // Load and play track
  const loadTrack = useCallback((track) => {
    setError(null);
    setIsLoading(true);

    // Stop current track if playing
    if (howlRef.current) {
      howlRef.current.stop();
      howlRef.current.unload();
    }

    // Create new Howl instance
    howlRef.current = new Howl({
      src: [track.fileUrl || '/audio/sample.mp3'], // Fallback to sample audio
      html5: true,
      preload: true,
      volume: volume,
      onload: () => {
        setIsLoading(false);
        setDuration(howlRef.current.duration());
        setCurrentTrack(track);
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
        // Auto-play next track could be implemented here
      },
      onloaderror: (id, error) => {
        setIsLoading(false);
        setError('Failed to load audio file');
        console.error('Audio load error:', error);
      },
      onplayerror: (id, error) => {
        setError('Failed to play audio');
        console.error('Audio play error:', error);
      }
    });
  }, [volume]);

  // Play/pause toggle
  const togglePlayPause = useCallback(() => {
    if (!howlRef.current) return;

    if (isPlaying) {
      howlRef.current.pause();
    } else {
      howlRef.current.play();
    }
  }, [isPlaying]);

  // Play specific track
  const playTrack = useCallback((track) => {
    if (currentTrack?.id === track.id) {
      togglePlayPause();
    } else {
      loadTrack(track);
      // Play will be triggered by onload callback
      setTimeout(() => {
        if (howlRef.current) {
          howlRef.current.play();
        }
      }, 100);
    }
  }, [currentTrack, togglePlayPause, loadTrack]);

  // Seek to specific time
  const seekTo = useCallback((time) => {
    if (howlRef.current) {
      howlRef.current.seek(time);
      setCurrentTime(time);
    }
  }, []);

  // Change volume
  const changeVolume = useCallback((newVolume) => {
    setVolume(newVolume);
    if (howlRef.current) {
      howlRef.current.volume(newVolume);
    }
  }, []);

  // Stop playback
  const stop = useCallback(() => {
    if (howlRef.current) {
      howlRef.current.stop();
    }
  }, []);

  // Previous track
  const previousTrack = useCallback(() => {
    // Implementation depends on playlist context
    console.log('Previous track');
  }, []);

  // Next track
  const nextTrack = useCallback(() => {
    // Implementation depends on playlist context
    console.log('Next track');
  }, []);

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

  return {
    // State
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isLoading,
    error,
    
    // Actions
    playTrack,
    togglePlayPause,
    seekTo,
    changeVolume,
    stop,
    previousTrack,
    nextTrack,
    
    // Helpers
    formatTime,
    
    // Progress percentage
    progress: duration > 0 ? (currentTime / duration) * 100 : 0
  };
};