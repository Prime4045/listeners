import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import apiService from '../services/api';

// Initial state
const initialState = {
  currentTrack: null,
  playlist: [],
  currentIndex: 0,
  isPlaying: false,
  isShuffled: false,
  repeatMode: 'none', // 'none', 'one', 'all'
  volume: 0.8,
  queue: [],
  history: [],
  isLoading: false,
  error: null,
};

// Action types
const MUSIC_ACTIONS = {
  SET_CURRENT_TRACK: 'SET_CURRENT_TRACK',
  SET_PLAYLIST: 'SET_PLAYLIST',
  SET_PLAYING: 'SET_PLAYING',
  SET_SHUFFLE: 'SET_SHUFFLE',
  SET_REPEAT: 'SET_REPEAT',
  SET_VOLUME: 'SET_VOLUME',
  ADD_TO_QUEUE: 'ADD_TO_QUEUE',
  REMOVE_FROM_QUEUE: 'REMOVE_FROM_QUEUE',
  CLEAR_QUEUE: 'CLEAR_QUEUE',
  NEXT_TRACK: 'NEXT_TRACK',
  PREVIOUS_TRACK: 'PREVIOUS_TRACK',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
};

// Reducer
const musicReducer = (state, action) => {
  switch (action.type) {
    case MUSIC_ACTIONS.SET_CURRENT_TRACK:
      return {
        ...state,
        currentTrack: action.payload.track,
        currentIndex: action.payload.index !== undefined ? action.payload.index : state.currentIndex,
        error: null,
      };

    case MUSIC_ACTIONS.SET_PLAYLIST:
      return {
        ...state,
        playlist: action.payload.playlist,
        currentIndex: action.payload.startIndex || 0,
        error: null,
      };

    case MUSIC_ACTIONS.SET_PLAYING:
      return {
        ...state,
        isPlaying: action.payload.isPlaying,
      };

    case MUSIC_ACTIONS.SET_SHUFFLE:
      return {
        ...state,
        isShuffled: action.payload.isShuffled,
      };

    case MUSIC_ACTIONS.SET_REPEAT:
      return {
        ...state,
        repeatMode: action.payload.repeatMode,
      };

    case MUSIC_ACTIONS.SET_VOLUME:
      return {
        ...state,
        volume: action.payload.volume,
      };

    case MUSIC_ACTIONS.ADD_TO_QUEUE:
      return {
        ...state,
        queue: [...state.queue, action.payload.track],
      };

    case MUSIC_ACTIONS.REMOVE_FROM_QUEUE:
      return {
        ...state,
        queue: state.queue.filter((_, index) => index !== action.payload.index),
      };

    case MUSIC_ACTIONS.CLEAR_QUEUE:
      return {
        ...state,
        queue: [],
      };

    case MUSIC_ACTIONS.NEXT_TRACK:
      const nextIndex = state.currentIndex + 1;
      const hasNextTrack = nextIndex < state.playlist.length;
      
      if (hasNextTrack || state.repeatMode === 'all') {
        const newIndex = hasNextTrack ? nextIndex : 0;
        return {
          ...state,
          currentIndex: newIndex,
          currentTrack: state.playlist[newIndex],
        };
      }
      return state;

    case MUSIC_ACTIONS.PREVIOUS_TRACK:
      const prevIndex = state.currentIndex - 1;
      const hasPrevTrack = prevIndex >= 0;
      
      if (hasPrevTrack || state.repeatMode === 'all') {
        const newIndex = hasPrevTrack ? prevIndex : state.playlist.length - 1;
        return {
          ...state,
          currentIndex: newIndex,
          currentTrack: state.playlist[newIndex],
        };
      }
      return state;

    case MUSIC_ACTIONS.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload.isLoading,
      };

    case MUSIC_ACTIONS.SET_ERROR:
      return {
        ...state,
        error: action.payload.error,
        isLoading: false,
      };

    case MUSIC_ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null,
      };

    default:
      return state;
  }
};

// Create context
const MusicContext = createContext();

// Provider component
export const MusicProvider = ({ children }) => {
  const [state, dispatch] = useReducer(musicReducer, initialState);
  const audioPlayer = useAudioPlayer();

  // Sync audio player with state
  useEffect(() => {
    if (state.currentTrack && state.currentTrack !== audioPlayer.currentTrack) {
      audioPlayer.playTrack(state.currentTrack);
    }
  }, [state.currentTrack]);

  useEffect(() => {
    audioPlayer.changeVolume(state.volume);
  }, [state.volume]);

  // Track play count when a song starts playing
  useEffect(() => {
    if (state.isPlaying && state.currentTrack) {
      apiService.trackPlay(state.currentTrack.id).catch(console.error);
    }
  }, [state.isPlaying, state.currentTrack]);

  // Play track
  const playTrack = (track, playlist = null, startIndex = 0) => {
    dispatch({
      type: MUSIC_ACTIONS.SET_CURRENT_TRACK,
      payload: { track, index: startIndex },
    });

    if (playlist) {
      dispatch({
        type: MUSIC_ACTIONS.SET_PLAYLIST,
        payload: { playlist, startIndex },
      });
    }

    dispatch({
      type: MUSIC_ACTIONS.SET_PLAYING,
      payload: { isPlaying: true },
    });
  };

  // Toggle play/pause
  const togglePlayPause = () => {
    const newIsPlaying = !state.isPlaying;
    dispatch({
      type: MUSIC_ACTIONS.SET_PLAYING,
      payload: { isPlaying: newIsPlaying },
    });
    audioPlayer.togglePlayPause();
  };

  // Next track
  const nextTrack = () => {
    if (state.queue.length > 0) {
      // Play from queue first
      const nextTrack = state.queue[0];
      dispatch({ type: MUSIC_ACTIONS.REMOVE_FROM_QUEUE, payload: { index: 0 } });
      playTrack(nextTrack);
    } else if (state.repeatMode === 'one') {
      // Repeat current track
      audioPlayer.seekTo(0);
      audioPlayer.togglePlayPause();
    } else {
      // Move to next track in playlist
      dispatch({ type: MUSIC_ACTIONS.NEXT_TRACK });
    }
  };

  // Previous track
  const previousTrack = () => {
    dispatch({ type: MUSIC_ACTIONS.PREVIOUS_TRACK });
  };

  // Set playlist
  const setPlaylist = (playlist, startIndex = 0) => {
    dispatch({
      type: MUSIC_ACTIONS.SET_PLAYLIST,
      payload: { playlist, startIndex },
    });

    if (playlist.length > 0) {
      dispatch({
        type: MUSIC_ACTIONS.SET_CURRENT_TRACK,
        payload: { track: playlist[startIndex], index: startIndex },
      });
    }
  };

  // Toggle shuffle
  const toggleShuffle = () => {
    const newIsShuffled = !state.isShuffled;
    dispatch({
      type: MUSIC_ACTIONS.SET_SHUFFLE,
      payload: { isShuffled: newIsShuffled },
    });

    // TODO: Implement playlist shuffling logic
  };

  // Toggle repeat mode
  const toggleRepeat = () => {
    const modes = ['none', 'all', 'one'];
    const currentIndex = modes.indexOf(state.repeatMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    
    dispatch({
      type: MUSIC_ACTIONS.SET_REPEAT,
      payload: { repeatMode: nextMode },
    });
  };

  // Set volume
  const setVolume = (volume) => {
    dispatch({
      type: MUSIC_ACTIONS.SET_VOLUME,
      payload: { volume },
    });
  };

  // Add to queue
  const addToQueue = (track) => {
    dispatch({
      type: MUSIC_ACTIONS.ADD_TO_QUEUE,
      payload: { track },
    });
  };

  // Remove from queue
  const removeFromQueue = (index) => {
    dispatch({
      type: MUSIC_ACTIONS.REMOVE_FROM_QUEUE,
      payload: { index },
    });
  };

  // Clear queue
  const clearQueue = () => {
    dispatch({ type: MUSIC_ACTIONS.CLEAR_QUEUE });
  };

  // Seek to position
  const seekTo = (time) => {
    audioPlayer.seekTo(time);
  };

  // Clear error
  const clearError = () => {
    dispatch({ type: MUSIC_ACTIONS.CLEAR_ERROR });
  };

  // Context value
  const value = {
    ...state,
    // Audio player state
    currentTime: audioPlayer.currentTime,
    duration: audioPlayer.duration,
    progress: audioPlayer.progress,
    formatTime: audioPlayer.formatTime,
    
    // Actions
    playTrack,
    togglePlayPause,
    nextTrack,
    previousTrack,
    setPlaylist,
    toggleShuffle,
    toggleRepeat,
    setVolume,
    addToQueue,
    removeFromQueue,
    clearQueue,
    seekTo,
    clearError,
  };

  return (
    <MusicContext.Provider value={value}>
      {children}
    </MusicContext.Provider>
  );
};

// Custom hook to use music context
export const useMusic = () => {
  const context = useContext(MusicContext);
  if (!context) {
    throw new Error('useMusic must be used within a MusicProvider');
  }
  return context;
};

export default MusicContext;