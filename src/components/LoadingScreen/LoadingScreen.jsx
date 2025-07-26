import React from 'react';
import { Music, Headphones, Radio, Disc3 } from 'lucide-react';
import './LoadingScreen.css';

const LoadingScreen = () => {
  return (
    <div className="loading-screen">
      <div className="loading-container">
        <div className="logo-animation">
          <div className="logo-icon" style={{ width: '60px', height: '60px' }}>
            <Music size={48} />
          </div>
          <h1 className="logo-text">Listeners</h1>
        </div>

        <div className="loading-animation">
          <div className="music-bars">
            <div className="bar"></div>
            <div className="bar"></div>
            <div className="bar"></div>
            <div className="bar"></div>
            <div className="bar"></div>
          </div>
        </div>

        <div className="loading-text">
          <p>Loading your music experience...</p>
        </div>

        <div className="floating-icons">
          <Headphones className="floating-icon icon-1" size={24} />
          <Radio className="floating-icon icon-2" size={20} />
          <Disc3 className="floating-icon icon-3" size={28} />
          <Music className="floating-icon icon-4" size={22} />
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;