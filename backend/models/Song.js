import mongoose from 'mongoose';

const songSchema = new mongoose.Schema({
  songUrl: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: function (url) {
        // Validate URL format
        try {
          new URL(url);
          return true;
        } catch {
          return false;
        }
      },
      message: 'Invalid URL format'
    }
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
  duration: {
    type: Number,
    min: 0,
    validate: {
      validator: function (duration) {
        return duration > 0;
      },
      message: 'Duration must be greater than 0'
    }
  },
  playCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  albumArt: {
    type: String,
    default: null,
    validate: {
      validator: function (url) {
        if (!url) return true; // Allow null/empty
        try {
          new URL(url);
          return true;
        } catch {
          return false;
        }
      },
      message: 'Invalid album art URL format'
    }
  },
  genre: {
    type: String,
    trim: true,
    maxlength: 50,
  },
  album: {
    type: String,
    trim: true,
    maxlength: 200,
  },
  releaseYear: {
    type: Number,
    min: 1900,
    max: new Date().getFullYear() + 1,
  },
  bitrate: {
    type: Number,
    min: 64,
    max: 320,
  },
  fileSize: {
    type: Number,
    min: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  tags: [{
    type: String,
    trim: true,
  }],
  lyrics: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  }
}, {
  timestamps: true,
});

// Indexes for performance
songSchema.index({ title: 'text', artist: 'text', album: 'text' });
songSchema.index({ artist: 1 });
songSchema.index({ genre: 1 });
songSchema.index({ playCount: -1 });
songSchema.index({ createdAt: -1 });
songSchema.index({ isActive: 1 });

// Virtual for formatted duration
songSchema.virtual('formattedDuration').get(function () {
  if (!this.duration) return '0:00';
  const minutes = Math.floor(this.duration / 60);
  const seconds = this.duration % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});

// Method to increment play count
songSchema.methods.incrementPlayCount = async function () {
  this.playCount += 1;
  this.updatedAt = new Date();
  return this.save();
};

// Static method to find popular songs
songSchema.statics.findPopular = function (limit = 10) {
  return this.find({ isActive: true })
    .sort({ playCount: -1, createdAt: -1 })
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
          { genre: { $regex: query, $options: 'i' } },
          { $text: { $search: query } }
        ]
      }
    ]
  })
    .sort({ playCount: -1, createdAt: -1 })
    .limit(limit);
};

// Pre-save middleware to update timestamps
songSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('Song', songSchema);