import React from 'react';
import { Music } from 'lucide-react';

const TrackList = ({ tracks }) => {
  if (!tracks || tracks.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
        <Music size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
        <p>No tracks available</p>
      </div>
    );
  }

  return (
    <div className="track-list">
      {tracks.map((track) => (
        <div key={track.spotifyId} className="track-item">
          <div className="track-image">
            <img
              src={track.imageUrl || 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=300'}
              alt={track.title}
              onError={(e) => {
                e.target.src = 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=300';
              }}
              style={{ width: '50px', height: '50px', objectFit: 'cover' }}
            />
          </div>
          <div className="track-info">
            <h4>{track.title}</h4>
            <p>{track.artist}</p>
            <small>{track.album}</small>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TrackList;