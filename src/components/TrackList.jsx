import { Play, Pause, Heart, MoreHorizontal } from 'lucide-react'
import './TrackList.css'

const TrackList = ({ tracks, currentTrack, isPlaying, onTrackSelect, onTogglePlay }) => {
  const formatDuration = (duration) => {
    if (!duration) return '0:00';
    const totalSeconds = Math.floor(duration / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  if (!tracks || tracks.length === 0) {
    return (
      <div className="track-list-empty">
        <p>No tracks available</p>
      </div>
    );
  }

  return (
    <div className="track-list">
      <div className="track-list-header">
        <div className="track-number">#</div>
        <div className="track-title">Title</div>
        <div className="track-album">Album</div>
        <div className="track-duration">Duration</div>
        <div className="track-actions"></div>
      </div>
      
      <div className="track-list-body">
        {tracks.map((track, index) => (
          <div 
            key={track.spotifyId || track.id || index} 
            className={`track-row ${currentTrack?.spotifyId === track.spotifyId ? 'active' : ''}`}
            onClick={() => onTrackSelect(track)}
          >
            <div className="track-number">
              {currentTrack?.spotifyId === track.spotifyId ? (
                <button 
                  className="track-play-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (onTogglePlay) {
                      onTogglePlay()
                    }
                  }}
                >
                  {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                </button>
              ) : (
                <span>{index + 1}</span>
              )}
            </div>
            
            <div className="track-info">
              <div className="track-name">{track.title}</div>
              <div className="track-artist">{track.artist}</div>
            </div>
            
            <div className="track-album">{track.album}</div>
            <div className="track-duration">{formatDuration(track.duration)}</div>
            
            <div className="track-actions">
              <button className="action-btn" title="Like this song">
                <Heart size={16} />
              </button>
              <button className="action-btn" title="More options">
                <MoreHorizontal size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default TrackList