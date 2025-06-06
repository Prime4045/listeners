import { Play, Pause, Heart, MoreHorizontal } from 'lucide-react'
import './TrackList.css'

const TrackList = ({ tracks, currentTrack, isPlaying, onTrackSelect, onTogglePlay }) => {
  const formatDuration = (duration) => {
    return duration
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
            key={track.id} 
            className={`track-row ${currentTrack?.id === track.id ? 'active' : ''}`}
            onClick={() => onTrackSelect(track)}
          >
            <div className="track-number">
              {currentTrack?.id === track.id ? (
                <button 
                  className="track-play-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    onTogglePlay()
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
              <button className="action-btn">
                <Heart size={16} />
              </button>
              <button className="action-btn">
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