import { createContext, useContext, useState, useCallback } from 'react';
import api from '../services/api';

const MusicContext = createContext({});

export const MusicProvider = ({ children }) => {
  const [trendingSongs, setTrendingSongs] = useState([]);
  const [currentSong, setCurrentSong] = useState(null);

  const fetchTrendingSongs = useCallback(async () => {
    try {
      const response = await api.get('/music/trending-songs');
      setTrendingSongs(response.data);
    } catch (error) {
      console.error('Failed to fetch trending songs:', error);
    }
  }, []);

  const playSong = useCallback(async (song) => {
    try {
      // If api.trackPlay is not a function, use api.post or api.get as appropriate
      // const response = await api.get(`/music/play/${song.spotifyId}`);
      const response = await api.post('/music/play', { spotifyId: song.spotifyId });
      setCurrentSong(response.data);
    } catch (error) {
      console.error('Failed to play song:', error);
    }
  }, []);

  const formatTime = (milliseconds) => {
    if (!milliseconds || isNaN(milliseconds)) return '0:00';
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const value = {
    trendingSongs,
    currentSong,
    fetchTrendingSongs,
    playSong,
    formatTime,
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