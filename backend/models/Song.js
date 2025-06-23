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
    trim: true,
    maxlength: 200,
  },
  duration: {
    type: Number,
    min: 0,
  },
  imageUrl: {
    type: String,
    validate: {
      validator: function (url) {
        if (!url) return true;
        try {
          new URL(url);
          return true;
        } catch {
          return false;
        }
      },
      message: 'Invalid image URL format'
    }
  },
  audioUrl: {
    type: String,
    required: true, // S3 signed URL
  },
  genre: {
    type: String,
    trim: true,
    maxlength: 50,
  },
  releaseDate: {
    type: Date,
  },
  popularity: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
  },
  explicit: {
    type: Boolean,
    default: false,
  },
  playCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  likeCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  spotifyData: {
    type: mongoose.Schema.Types.Mixed, // Store full Spotify metadata
  },
  s3Key: {
    type: String,
    required: true, // S3 object key
  },
  audioMetadata: {
    size: Number,
    lastModified: Date,
    contentType: String,
  },
}, {
  timestamps: true,
});

// Indexes for performance
songSchema.index({ title: 'text', artist: 'text', album: 'text' });
songSchema.index({ artist: 1 });
songSchema.index({ genre: 1 });
songSchema.index({ playCount: -1 });
songSchema.index({ popularity: -1 });
songSchema.index({ createdAt: -1 });
songSchema.index({ isActive: 1 });

// Virtual for formatted duration
songSchema.virtual('formattedDuration').get(function () {
  if (!this.duration) return '0:00';
  const minutes = Math.floor(this.duration / 60000);
  const seconds = Math.floor((this.duration % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});

// Method to increment play count
songSchema.methods.incrementPlayCount = async function () {
  this.playCount += 1;
  return this.save();
};

// Static method to find popular songs
songSchema.statics.findPopular = function (limit = 10) {
  return this.find({ isActive: true })
    .sort({ playCount: -1, popularity: -1, createdAt: -1 })
    .limit(limit);
};

// Static method to search songs in database
songSchema.statics.searchInDatabase = function (query, limit = 20) {
  return this.find({
    $and: [
      { isActive: true },
      {
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { artist: { $regex: query, $options: 'i' } },
          { album: { $regex: query, $options: 'i' } },
          { genre: { $regex: query, $options: 'i' } },
          { $text: { $search: query } }
        ]
      }
    ]
  })
    .sort({ playCount: -1, popularity: -1, createdAt: -1 })
    .limit(limit);
};

// Static method to get all songs from database
songSchema.statics.getAllSongs = function (limit = 50, skip = 0) {
  return this.find({ isActive: true })
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);
};

export default mongoose.model('Song', songSchema);