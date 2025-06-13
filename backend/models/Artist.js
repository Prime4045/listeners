import mongoose from 'mongoose';

const artistSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
    },
    bio: {
        type: String,
        trim: true,
        maxlength: 1000,
    },
    profileImage: {
        type: String,
        default: null,
    },
    genres: [{
        type: String,
        trim: true,
    }],
    followers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
}, {
    timestamps: true,
});

artistSchema.index({ name: 'text' });
artistSchema.index({ genres: 1 });

artistSchema.virtual('followerCount').get(function () {
    return this.followers.length;
});

export default mongoose.model('Artist', artistSchema);