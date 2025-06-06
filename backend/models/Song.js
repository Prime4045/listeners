const mongoose = require('mongoose');

const songSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  artist: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  album: {
    type: String,
    trim: true,
    maxlength: 100
  },
  genre: {
    type: String,
    trim: true,
    maxlength: 50
  },
  duration: {
    type: Number, // Duration in seconds
    required: true,
    min: 1
  },
  fileUrl: {
    type: String,
    required: true
  },
  coverImage: {
    type: String,
    default: null
  },
  releaseDate: {
    type: Date,
    default: Date.now
  },
  playCount: {
    type: Number,
    default: 0
  },
  likes: {
    type: Number,
    default: 0
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  lyrics: {
    type: String,
    default: null
  },
  audioFeatures: {
    tempo: Number,
    key: String,
    energy: Number,
    danceability: Number,
    valence: Number
  }
}, {
  timestamps: true
});

// Indexes for better query performance
songSchema.index({ title: 'text', artist: 'text', album: 'text' });
songSchema.index({ artist: 1 });
songSchema.index({ genre: 1 });
songSchema.index({ playCount: -1 });
songSchema.index({ createdAt: -1 });
songSchema.index({ uploadedBy: 1 });

// Virtual for formatted duration
songSchema.virtual('formattedDuration').get(function() {
  const minutes = Math.floor(this.duration / 60);
  const seconds = this.duration % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});

// Method to increment play count
songSchema.methods.incrementPlayCount = function() {
  this.playCount += 1;
  return this.save();
};

module.exports = mongoose.model('Song', songSchema);