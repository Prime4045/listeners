import React, { createContext, useContext, useState, useRef, useEffect } from 'react';

const MusicContext = createContext();

export const MusicProvider = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(parseFloat(localStorage.getItem('playerVolume')) || 0.5);
  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState('none'); // none, track, playlist
  const [trackList, setTrackList] = useState([]);
  const audioRef = useRef(new Audio());

  useEffect(() => {
    audioRef.current.volume = volume;
  }, [volume]);

  const playTrack = (track, tracks = []) => {
    if (!track.previewUrl) {
      console.warn('No preview URL available for this track');
      return;
    }
    setTrackList(tracks);
    setCurrentTrack(track);
    audioRef.current.src = track.previewUrl;
    audioRef.current.play().then(() => setIsPlaying(true)).catch((err) => console.error('Playback error:', err));
    setCurrentTime(0);
    setProgress(0);
  };

  const togglePlayPause = () => {
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch((err) => console.error('Playback error:', err));
    }
  };

  const toggleShuffle = () => {
    setIsShuffled(!isShuffled);
  };

  const toggleRepeat = () => {
    setRepeatMode(repeatMode === 'none' ? 'track' : repeatMode === 'track' ? 'playlist' : 'none');
  };

  const previousTrack = () => {
    if (!trackList.length) return;
    const currentIndex = trackList.findIndex((t) => t.spotifyId === currentTrack?.spotifyId);
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : trackList.length - 1;
    playTrack(trackList[prevIndex], trackList);
  };

  const nextTrack = () => {
    if (!trackList.length) return;
    let nextIndex;
    if (isShuffled) {
      nextIndex = Math.floor(Math.random() * trackList.length);
    } else {
      const currentIndex = trackList.findIndex((t) => t.spotifyId === currentTrack?.spotifyId);
      nextIndex = currentIndex < trackList.length - 1 ? currentIndex + 1 : 0;
    }
    playTrack(trackList[nextIndex], trackList);
  };

  const seekTo = (percent) => {
    const newTime = (percent / 100) * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    setProgress(percent);
  };

  const formatTime = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const audio = audioRef.current;
    const updateTime = () => {
      setCurrentTime(audio.currentTime);
      setProgress((audio.currentTime / audio.duration) * 100 || 0);
    };
    const setAudioDuration = () => setDuration(audio.duration);
    const handleEnded = () => {
      if (repeatMode === 'track') {
        audio.currentTime = 0;
        audio.play();
      } else if (repeatMode === 'playlist' || !repeatMode) {
        nextTrack();
      } else {
        setIsPlaying(false);
      }
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', setAudioDuration);
    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', setAudioDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [trackList, repeatMode]);

  return (
    <MusicContext.Provider
      value={{
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        progress,
        volume,
        isShuffled,
        repeatMode,
        playTrack,
        togglePlayPause,
        toggleShuffle,
        previousTrack,
        nextTrack,
        toggleRepeat,
        seekTo,
        setVolume,
        formatTime,
      }}
    >
      {children}
    </MusicContext.Provider>
  );
};

export const useMusic = () => useContext(MusicContext);