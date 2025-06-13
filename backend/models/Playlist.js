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
}, {
  timestamps: true,
});

playlistSchema.index({ owner: 1 });
playlistSchema.index({ name: 'text', description: 'text' });
playlistSchema.index({ isPublic: 1 });
playlistSchema.index({ createdAt: -1 });

playlistSchema.virtual('totalDuration').get(function () {
  if (!this.populated('songs.song')) {
    return 0;
  }
  return this.songs.reduce((total, { song }) => total + (song.duration || 0), 0);
});

playlistSchema.virtual('songCount').get(function () {
  return this.songs.length;
});

playlistSchema.methods.addSong = async function (songId, userId) {
  const existingSong = this.songs.find((s) => s.song.toString() === songId.toString());
  if (existingSong) {
    throw new Error('Song already exists in playlist');
  }

  this.songs.push({
    song: songId,
    addedBy: userId,
  });

  return this.save();
};

playlistSchema.methods.removeSong = async function (songId) {
  this.songs = this.songs.filter((s) => s.song.toString() !== songId.toString());
  return this.save();
};

playlistSchema.pre('save', function (next) {
  this.collaborators = [...new Map(this.collaborators.map((item) => [item.user.toString(), item])).values()];
  next();
});

export default mongoose.model('Playlist', playlistSchema);