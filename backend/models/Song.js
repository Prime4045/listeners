import mongoose from 'mongoose';

const songSchema = new mongoose.Schema({
  spotifyId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  },
  artist: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  },
  album: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  },
  duration: {
    type: Number,
    required: true,
    min: 0,
  },
  releaseDate: {
    type: Date,
    default: null,
  },
  previewUrl: {
    type: String,
    default: null,
  },
  imageUrl: {
    type: String,
    default: null,
  },
  cloudinaryUrl: {
    type: String,
    default: null,
  },
  cloudinaryPublicId: {
    type: String,
    default: null,
  },
  genres: [{
    type: String,
    trim: true,
  }],
  popularity: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  explicit: {
    type: Boolean,
    default: false,
  },
  playCount: {
    type: Number,
    default: 0,
  },
  likeCount: {
    type: Number,
    default: 0,
  },
  metadata: {
    tempo: Number,
    key: String,
    mode: String,
    timeSignature: Number,
    acousticness: Number,
    danceability: Number,
    energy: Number,
    instrumentalness: Number,
    liveness: Number,
    loudness: Number,
    speechiness: Number,
    valence: Number,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Indexes for performance
songSchema.index({ title: 'text', artist: 'text', album: 'text' });
songSchema.index({ artist: 1 });
songSchema.index({ album: 1 });
songSchema.index({ genres: 1 });
songSchema.index({ popularity: -1 });
songSchema.index({ playCount: -1 });
songSchema.index({ createdAt: -1 });
songSchema.index({ releaseDate: -1 });

// Virtual for formatted duration
songSchema.virtual('formattedDuration').get(function () {
  if (!this.duration) return '0:00';
  const totalSeconds = Math.floor(this.duration / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});

// Method to increment play count
songSchema.methods.incrementPlayCount = async function () {
  this.playCount += 1;
  return this.save();
};

// Method to get audio URL (Cloudinary or preview)
songSchema.methods.getAudioUrl = function () {
  return this.cloudinaryUrl || this.previewUrl;
};

// Static method to find popular songs
songSchema.statics.findPopular = function (limit = 10) {
  return this.find({ isActive: true })
    .sort({ popularity: -1, playCount: -1 })
    .limit(limit);
};

// Static method to search songs
songSchema.statics.searchSongs = function (query, limit = 20) {
  return this.find({
    $and: [
      { isActive: true },
      {
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { artist: { $regex: query, $options: 'i' } },
          { album: { $regex: query, $options: 'i' } },
          { $text: { $search: query } }
        ]
      }
    ]
  })
    .sort({ popularity: -1, playCount: -1 })
    .limit(limit);
};

// Pre-save middleware to update timestamps
songSchema.pre('save', function (next) {
  if (this.isModified('playCount')) {
    this.updatedAt = new Date();
  }
  next();
});

export default mongoose.model('Song', songSchema);