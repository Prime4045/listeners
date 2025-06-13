import mongoose from 'mongoose';

const songSchema = new mongoose.Schema({
  spotifyId: {
    type: String,
    required: true,
    unique: true,
  },
  title: {
    type: String,
    required: true,
  },
  artist: {
    type: String,
    required: true,
  },
  album: {
    type: String,
    required: true,
  },
  duration: {
    type: Number,
    required: true,
  },
  previewUrl: {
    type: String,
    default: null,
  },
  imageUrl: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model('Song', songSchema);