import mongoose from 'mongoose';

const userLikesSchema = new mongoose.Schema({
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
  likedAt: {
    type: Date,
    default: Date.now,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Compound index to ensure unique user-song combinations
userLikesSchema.index({ user: 1, song: 1 }, { unique: true });

// Index for efficient queries
userLikesSchema.index({ user: 1, likedAt: -1 });
userLikesSchema.index({ song: 1, likedAt: -1 });
userLikesSchema.index({ isActive: 1 });

// Static method to like a song
userLikesSchema.statics.likeSong = async function (userId, songId) {
  try {
    const existingLike = await this.findOne({ user: userId, song: songId });

    if (existingLike) {
      if (existingLike.isActive) {
        // Unlike the song
        existingLike.isActive = false;
        await existingLike.save();

        // Decrement like count on song
        await mongoose.model('Song').findByIdAndUpdate(songId, {
          $inc: { likeCount: -1 }
        });

        return { liked: false, message: 'Song unliked' };
      } else {
        // Re-like the song
        existingLike.isActive = true;
        existingLike.likedAt = new Date();
        await existingLike.save();

        // Increment like count on song
        await mongoose.model('Song').findByIdAndUpdate(songId, {
          $inc: { likeCount: 1 }
        });

        return { liked: true, message: 'Song liked' };
      }
    } else {
      // Create new like
      const newLike = new this({
        user: userId,
        song: songId,
      });
      await newLike.save();

      // Increment like count on song
      await mongoose.model('Song').findByIdAndUpdate(songId, {
        $inc: { likeCount: 1 }
      });

      return { liked: true, message: 'Song liked' };
    }
  } catch (error) {
    if (error.code === 11000) {
      // Handle duplicate key error
      throw new Error('Like already exists');
    }
    throw error;
  }
};

// Static method to get user's liked songs
userLikesSchema.statics.getUserLikedSongs = function (userId, limit = 50, skip = 0) {
  return this.find({ user: userId, isActive: true })
    .populate('song')
    .sort({ likedAt: -1 })
    .limit(limit)
    .skip(skip);
};

// Static method to check if user liked a song
userLikesSchema.statics.isLikedByUser = function (userId, songId) {
  return this.findOne({ user: userId, song: songId, isActive: true });
};

// Static method to get song's like count
userLikesSchema.statics.getSongLikeCount = function (songId) {
  return this.countDocuments({ song: songId, isActive: true });
};

// Static method to get most liked songs
userLikesSchema.statics.getMostLikedSongs = function (limit = 10) {
  return this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: '$song',
        likeCount: { $sum: 1 },
        latestLike: { $max: '$likedAt' }
      }
    },
    { $sort: { likeCount: -1, latestLike: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'songs',
        localField: '_id',
        foreignField: '_id',
        as: 'song'
      }
    },
    { $unwind: '$song' },
    {
      $project: {
        song: 1,
        likeCount: 1,
        latestLike: 1
      }
    }
  ]);
};

export default mongoose.model('UserLikes', userLikesSchema);