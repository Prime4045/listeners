import mongoose from 'mongoose';

const musicSchema = new mongoose.Schema({
    title: String,
    artist: String,
    cloudinaryUrl: String,
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Music', musicSchema);