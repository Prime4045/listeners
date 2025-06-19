import mongoose from 'mongoose';

const playlistSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  coverImage: {
    type: String,
    default: null,
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  songs: [{
    song: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Song',
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    position: {
      type: Number,
      default: 0,
    }
  }],
  isPublic: {
    type: Boolean,
    default: false,
  },
  isCollaborative: {
    type: Boolean,
    default: false,
  },
  collaborators: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    permissions: {
      type: String,
      enum: ['view', 'edit', 'admin'],
      default: 'edit',
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  tags: [{
    type: String,
    trim: true,
  }],
  playCount: {
    type: Number,
    default: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  shuffleMode: {
    type: Boolean,
    default: false,
  },
  repeatMode: {
    type: String,
    enum: ['none', 'playlist', 'song'],
    default: 'none',
  },
}, {
  timestamps: true,
});

// Indexes for performance
playlistSchema.index({ owner: 1 });
playlistSchema.index({ name: 'text', description: 'text' });
playlistSchema.index({ isPublic: 1 });
playlistSchema.index({ createdAt: -1 });
playlistSchema.index({ playCount: -1 });

// Virtual for total duration
playlistSchema.virtual('totalDuration').get(function () {
  if (!this.populated('songs.song')) {
    return 0;
  }
  return this.songs.reduce((total, { song }) => total + (song.duration || 0), 0);
});

// Virtual for song count
playlistSchema.virtual('songCount').get(function () {
  return this.songs.length;
});

// Method to add song to playlist
playlistSchema.methods.addSong = async function (songId, userId) {
  const existingSong = this.songs.find((s) => s.song.toString() === songId.toString());
  if (existingSong) {
    throw new Error('Song already exists in playlist');
  }

  const position = this.songs.length;
  this.songs.push({
    song: songId,
    addedBy: userId,
    position: position,
  });

  return this.save();
};

// Method to remove song from playlist
playlistSchema.methods.removeSong = async function (songId) {
  this.songs = this.songs.filter((s) => s.song.toString() !== songId.toString());

  // Reorder positions
  this.songs.forEach((song, index) => {
    song.position = index;
  });

  return this.save();
};

// Method to reorder songs
playlistSchema.methods.reorderSongs = async function (songId, newPosition) {
  const songIndex = this.songs.findIndex(s => s.song.toString() === songId.toString());
  if (songIndex === -1) {
    throw new Error('Song not found in playlist');
  }

  const [song] = this.songs.splice(songIndex, 1);
  this.songs.splice(newPosition, 0, song);

  // Update positions
  this.songs.forEach((song, index) => {
    song.position = index;
  });

  return this.save();
};

// Method to increment play count
playlistSchema.methods.incrementPlayCount = async function () {
  this.playCount += 1;
  return this.save();
};

// Pre-save middleware to remove duplicate collaborators
playlistSchema.pre('save', function (next) {
  this.collaborators = [...new Map(this.collaborators.map((item) => [item.user.toString(), item])).values()];
  next();
});

export default mongoose.model('Playlist', playlistSchema);