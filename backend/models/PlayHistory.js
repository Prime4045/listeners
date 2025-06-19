import mongoose from 'mongoose';

const playHistorySchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    song: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Song',
        required: true,
        index: true,
    },
    playedAt: {
        type: Date,
        default: Date.now,
        index: true,
    },
    playDuration: {
        type: Number,
        default: 0,
        min: 0,
    },
    completedPercentage: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
    },
    deviceInfo: {
        userAgent: String,
        platform: String,
        browser: String,
    },
    sessionId: {
        type: String,
        index: true,
    },
}, {
    timestamps: true,
});

// Compound indexes for efficient queries
playHistorySchema.index({ user: 1, playedAt: -1 });
playHistorySchema.index({ song: 1, playedAt: -1 });
playHistorySchema.index({ user: 1, song: 1 });

// Static method to get user's play history
playHistorySchema.statics.getUserHistory = function (userId, limit = 50) {
    return this.find({ user: userId })
        .populate('song')
        .sort({ playedAt: -1 })
        .limit(limit);
};

// Static method to get song's play statistics
playHistorySchema.statics.getSongStats = function (songId) {
    return this.aggregate([
        { $match: { song: mongoose.Types.ObjectId(songId) } },
        {
            $group: {
                _id: '$song',
                totalPlays: { $sum: 1 },
                uniqueUsers: { $addToSet: '$user' },
                avgPlayDuration: { $avg: '$playDuration' },
                avgCompletionRate: { $avg: '$completedPercentage' },
                lastPlayed: { $max: '$playedAt' }
            }
        },
        {
            $project: {
                totalPlays: 1,
                uniqueUsers: { $size: '$uniqueUsers' },
                avgPlayDuration: { $round: ['$avgPlayDuration', 2] },
                avgCompletionRate: { $round: ['$avgCompletionRate', 2] },
                lastPlayed: 1
            }
        }
    ]);
};

export default mongoose.model('PlayHistory', playHistorySchema);