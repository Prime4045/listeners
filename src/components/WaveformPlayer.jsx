import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

const WaveformPlayer = ({ 
  audioUrl, 
  isPlaying, 
  onPlayPause, 
  height = 60,
  waveColor = '#8b5cf6',
  progressColor = '#a855f7',
  cursorColor = '#ffffff',
  backgroundColor = 'transparent'
}) => {
  const waveformRef = useRef(null);
  const wavesurfer = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (waveformRef.current) {
      // Initialize WaveSurfer
      wavesurfer.current = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: waveColor,
        progressColor: progressColor,
        cursorColor: cursorColor,
        backgroundColor: backgroundColor,
        height: height,
        responsive: true,
        normalize: true,
        backend: 'WebAudio',
        mediaControls: false,
        interact: true,
        hideScrollbar: true,
        barWidth: 2,
        barGap: 1,
        barRadius: 1,
      });

      // Event listeners
      wavesurfer.current.on('ready', () => {
        setIsLoading(false);
        setDuration(wavesurfer.current.getDuration());
        wavesurfer.current.setVolume(volume);
      });

      wavesurfer.current.on('loading', (percent) => {
        setIsLoading(percent < 100);
      });

      wavesurfer.current.on('audioprocess', () => {
        setCurrentTime(wavesurfer.current.getCurrentTime());
      });

      wavesurfer.current.on('seek', () => {
        setCurrentTime(wavesurfer.current.getCurrentTime());
      });

      wavesurfer.current.on('play', () => {
        if (onPlayPause) onPlayPause(true);
      });

      wavesurfer.current.on('pause', () => {
        if (onPlayPause) onPlayPause(false);
      });

      wavesurfer.current.on('error', (error) => {
        console.error('WaveSurfer error:', error);
        setIsLoading(false);
      });

      // Load audio
      if (audioUrl) {
        setIsLoading(true);
        wavesurfer.current.load(audioUrl);
      }
    }

    return () => {
      if (wavesurfer.current) {
        wavesurfer.current.destroy();
      }
    };
  }, [audioUrl, height, waveColor, progressColor, cursorColor, backgroundColor]);

  // Sync play/pause state
  useEffect(() => {
    if (wavesurfer.current) {
      if (isPlaying && !wavesurfer.current.isPlaying()) {
        wavesurfer.current.play();
      } else if (!isPlaying && wavesurfer.current.isPlaying()) {
        wavesurfer.current.pause();
      }
    }
  }, [isPlaying]);

  const handlePlayPause = () => {
    if (wavesurfer.current) {
      wavesurfer.current.playPause();
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (wavesurfer.current) {
      wavesurfer.current.setVolume(newVolume);
    }
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    if (wavesurfer.current) {
      if (isMuted) {
        wavesurfer.current.setVolume(volume);
        setIsMuted(false);
      } else {
        wavesurfer.current.setVolume(0);
        setIsMuted(true);
      }
    }
  };

  const formatTime = (time) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="waveform-player">
      <div className="flex items-center gap-4 mb-2">
        <button
          onClick={handlePlayPause}
          disabled={isLoading}
          className="flex items-center justify-center w-10 h-10 bg-purple-600 hover:bg-purple-700 rounded-full transition-colors disabled:opacity-50"
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-5 h-5 text-white" />
          ) : (
            <Play className="w-5 h-5 text-white ml-0.5" />
          )}
        </button>

        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span>{formatTime(currentTime)}</span>
          <span>/</span>
          <span>{formatTime(duration)}</span>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={toggleMute}
            className="text-gray-400 hover:text-white transition-colors"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
          />
        </div>
      </div>

      <div 
        ref={waveformRef} 
        className="waveform-container rounded-lg overflow-hidden bg-gray-800/50"
        style={{ height: `${height}px` }}
      />

      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <div className="text-sm text-gray-400">Loading audio...</div>
        </div>
      )}
    </div>
  );
};

export default WaveformPlayer;