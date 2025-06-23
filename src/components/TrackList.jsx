import { Play, Pause, Heart, MoreHorizontal, AlertCircle } from 'lucide-react'
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
        <div className="track-actions">Status</div>
      </div>

      <div className="track-list-body">
        {tracks.map((track, index) => (
          <div
            key={track.spotifyId || track.id || index}
            className={`track-row ${currentTrack?.spotifyId === track.spotifyId ? 'active' : ''} ${!track.canPlay ? 'disabled' : ''}`}
            onClick={() => track.canPlay && onTrackSelect(track)}
            style={{ cursor: track.canPlay ? 'pointer' : 'not-allowed' }}
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
                  disabled={!track.canPlay}
                >
                  {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                </button>
              ) : (
                <span>{index + 1}</span>
              )}
            </div>

            <div className="track-info">
              <div className="track-name" style={{ opacity: track.canPlay ? 1 : 0.6 }}>
                {track.title}
                {!track.canPlay && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                    (Not Available)
                  </span>
                )}
              </div>
              <div className="track-artist" style={{ opacity: track.canPlay ? 1 : 0.6 }}>
                {track.artist}
              </div>
            </div>

            <div className="track-album" style={{ opacity: track.canPlay ? 1 : 0.6 }}>
              {track.album}
            </div>

            <div className="track-duration" style={{ opacity: track.canPlay ? 1 : 0.6 }}>
              {formatDuration(track.duration)}
            </div>

            <div className="track-actions">
              {track.canPlay ? (
                <>
                  <button className="action-btn" title="Like this song">
                    <Heart size={16} />
                  </button>
                  <button className="action-btn" title="More options">
                    <MoreHorizontal size={16} />
                  </button>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                  <AlertCircle size={16} />
                  <span style={{ fontSize: '0.75rem' }}>Coming Soon</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default TrackList