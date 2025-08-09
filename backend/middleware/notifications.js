import Notification from '../models/Notification.js';

class NotificationService {
  /**
   * Create welcome notification for new users
   */
  static async createWelcomeNotification(userId, username) {
    try {
      await Notification.createNotification(userId, {
        type: 'welcome',
        title: `Welcome to Listeners, ${username}!`,
        message: 'Start exploring millions of songs and create your first playlist.',
        priority: 'medium',
        actionUrl: '/search',
        actionText: 'Discover Music',
        data: {
          isWelcome: true,
          username
        }
      });
    } catch (error) {
      console.error('Failed to create welcome notification:', error);
    }
  }

  /**
   * Create song added notification
   */
  static async createSongAddedNotification(userId, songData) {
    try {
      await Notification.createNotification(userId, {
        type: 'song_added',
        title: 'New song available!',
        message: `"${songData.title}" by ${songData.artist} is now available to stream.`,
        priority: 'low',
        actionUrl: `/search?q=${encodeURIComponent(songData.title)}`,
        actionText: 'Listen Now',
        data: {
          songId: songData.spotifyId,
          title: songData.title,
          artist: songData.artist,
          imageUrl: songData.imageUrl
        }
      });
    } catch (error) {
      console.error('Failed to create song added notification:', error);
    }
  }

  /**
   * Create playlist created notification
   */
  static async createPlaylistNotification(userId, playlistData) {
    try {
      await Notification.createNotification(userId, {
        type: 'playlist_created',
        title: 'Playlist created successfully!',
        message: `Your playlist "${playlistData.name}" is ready to fill with amazing music.`,
        priority: 'medium',
        actionUrl: `/playlist/${playlistData._id}`,
        actionText: 'View Playlist',
        data: {
          playlistId: playlistData._id,
          playlistName: playlistData.name
        }
      });
    } catch (error) {
      console.error('Failed to create playlist notification:', error);
    }
  }

  /**
   * Create achievement notification
   */
  static async createAchievementNotification(userId, achievement) {
    try {
      await Notification.createNotification(userId, {
        type: 'achievement',
        title: `Achievement Unlocked: ${achievement.title}!`,
        message: achievement.description,
        priority: 'high',
        actionUrl: '/profile',
        actionText: 'View Profile',
        data: {
          achievementId: achievement.id,
          achievementType: achievement.type
        }
      });
    } catch (error) {
      console.error('Failed to create achievement notification:', error);
    }
  }

  /**
   * Create system update notification
   */
  static async createSystemNotification(userIds, updateData) {
    try {
      const notifications = await Promise.all(
        userIds.map(userId => 
          Notification.createNotification(userId, {
            type: 'system_update',
            title: updateData.title,
            message: updateData.message,
            priority: updateData.priority || 'medium',
            actionUrl: updateData.actionUrl,
            actionText: updateData.actionText,
            data: updateData.data || {}
          })
        )
      );
      
      return notifications;
    } catch (error) {
      console.error('Failed to create system notifications:', error);
      throw error;
    }
  }

  /**
   * Create recommendation notification
   */
  static async createRecommendationNotification(userId, recommendations) {
    try {
      await Notification.createNotification(userId, {
        type: 'recommendation',
        title: 'New music recommendations!',
        message: `We found ${recommendations.length} songs you might love based on your listening history.`,
        priority: 'low',
        actionUrl: '/recommendations',
        actionText: 'Check Them Out',
        data: {
          recommendations: recommendations.slice(0, 5), // Limit data size
          count: recommendations.length
        }
      });
    } catch (error) {
      console.error('Failed to create recommendation notification:', error);
    }
  }

  /**
   * Clean up old notifications
   */
  static async cleanupOldNotifications() {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const result = await Notification.deleteMany({
        createdAt: { $lt: thirtyDaysAgo },
        isRead: true
      });
      
      console.log(`Cleaned up ${result.deletedCount} old notifications`);
      return result.deletedCount;
    } catch (error) {
      console.error('Failed to cleanup notifications:', error);
      return 0;
    }
  }
}

export default NotificationService;