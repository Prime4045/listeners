import React, { useEffect, useRef, useState } from 'react';
import { useMusic } from '../../contexts/MusicContext';
import './AudioVisualizer.css';

const AudioVisualizer = ({ 
  type = 'bars', // 'bars', 'wave', 'circle'
  size = 'medium', // 'small', 'medium', 'large'
  color = 'purple',
  animated = true 
}) => {
  const { isPlaying, currentTrack } = useMusic();
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const [audioContext, setAudioContext] = useState(null);
  const [analyser, setAnalyser] = useState(null);

  useEffect(() => {
    if (isPlaying && currentTrack) {
      initializeAudioContext();
    } else {
      stopVisualization();
    }

    return () => stopVisualization();
  }, [isPlaying, currentTrack]);

  const initializeAudioContext = async () => {
    try {
      // Create audio context
      const context = new (window.AudioContext || window.webkitAudioContext)();
      const analyserNode = context.createAnalyser();
      
      analyserNode.fftSize = 256;
      analyserNode.smoothingTimeConstant = 0.8;
      
      setAudioContext(context);
      setAnalyser(analyserNode);
      
      if (animated) {
        startVisualization(analyserNode);
      }
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
    }
  };

  const startVisualization = (analyserNode) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!isPlaying) return;

      analyserNode.getByteFrequencyData(dataArray);
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      switch (type) {
        case 'bars':
          drawBars(ctx, dataArray, canvas.width, canvas.height);
          break;
        case 'wave':
          drawWave(ctx, dataArray, canvas.width, canvas.height);
          break;
        case 'circle':
          drawCircle(ctx, dataArray, canvas.width, canvas.height);
          break;
        default:
          drawBars(ctx, dataArray, canvas.width, canvas.height);
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();
  };

  const drawBars = (ctx, dataArray, width, height) => {
    const barWidth = width / dataArray.length * 2.5;
    let x = 0;

    for (let i = 0; i < dataArray.length; i++) {
      const barHeight = (dataArray[i] / 255) * height * 0.8;
      
      const gradient = ctx.createLinearGradient(0, height - barHeight, 0, height);
      gradient.addColorStop(0, getColorValue(color, 0.8));
      gradient.addColorStop(1, getColorValue(color, 0.3));
      
      ctx.fillStyle = gradient;
      ctx.fillRect(x, height - barHeight, barWidth, barHeight);
      
      x += barWidth + 1;
    }
  };

  const drawWave = (ctx, dataArray, width, height) => {
    ctx.lineWidth = 2;
    ctx.strokeStyle = getColorValue(color, 0.8);
    ctx.beginPath();

    const sliceWidth = width / dataArray.length;
    let x = 0;

    for (let i = 0; i < dataArray.length; i++) {
      const v = dataArray[i] / 128.0;
      const y = v * height / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx.lineTo(width, height / 2);
    ctx.stroke();
  };

  const drawCircle = (ctx, dataArray, width, height) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 4;

    ctx.lineWidth = 2;
    
    for (let i = 0; i < dataArray.length; i++) {
      const angle = (i / dataArray.length) * 2 * Math.PI;
      const amplitude = (dataArray[i] / 255) * radius;
      
      const x1 = centerX + Math.cos(angle) * radius;
      const y1 = centerY + Math.sin(angle) * radius;
      const x2 = centerX + Math.cos(angle) * (radius + amplitude);
      const y2 = centerY + Math.sin(angle) * (radius + amplitude);
      
      ctx.strokeStyle = getColorValue(color, dataArray[i] / 255);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  };

  const getColorValue = (colorName, opacity = 1) => {
    const colors = {
      purple: `rgba(139, 92, 246, ${opacity})`,
      pink: `rgba(236, 72, 153, ${opacity})`,
      blue: `rgba(59, 130, 246, ${opacity})`,
      green: `rgba(34, 197, 94, ${opacity})`,
      orange: `rgba(249, 115, 22, ${opacity})`,
      red: `rgba(239, 68, 68, ${opacity})`
    };
    return colors[colorName] || colors.purple;
  };

  const stopVisualization = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    if (audioContext) {
      audioContext.close();
      setAudioContext(null);
      setAnalyser(null);
    }
  };

  const getCanvasSize = () => {
    const sizes = {
      small: { width: 100, height: 40 },
      medium: { width: 200, height: 80 },
      large: { width: 400, height: 160 }
    };
    return sizes[size] || sizes.medium;
  };

  const canvasSize = getCanvasSize();

  if (!animated || !isPlaying) {
    // Static visualization
    return (
      <div className={`audio-visualizer static ${size}`}>
        <div className="static-bars">
          {Array.from({ length: 20 }, (_, i) => (
            <div
              key={i}
              className="static-bar"
              style={{
                height: `${Math.random() * 60 + 20}%`,
                backgroundColor: getColorValue(color, 0.6),
                animationDelay: `${i * 0.1}s`
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`audio-visualizer ${size}`}>
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="visualizer-canvas"
      />
    </div>
  );
};

export default AudioVisualizer;