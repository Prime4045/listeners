import React, { useState, useEffect } from 'react';
import { 
  User, 
  Music, 
  Heart, 
  Clock, 
  Calendar,
  TrendingUp,
  Settings,
  Crown,
  Play,
  Headphones,
  Users,
  Award,
  Activity
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import ApiService from '../../services/api';
import './Dashboard.css';

const Dashboard = () => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await ApiService.getUserDashboard();
      setDashboardData(data);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDuration = (ms) => {
    if (!ms) return '0:00';
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-error">
        <p>{error}</p>
        <button onClick={loadDashboardData}>Try Again</button>
      </div>
    );
  }

  const { stats, recentActivity } = dashboardData || {};

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="welcome-section">
          <div className="user-avatar">
            {user?.profilePicture ? (
              <img src={user.profilePicture} alt={user.username} />
            ) : (
              <User size={32} />
            )}
          </div>
          <div className="welcome-text">
            <h1>Welcome back, {user?.firstName || user?.username}!</h1>
            <p>Here's what's happening with your music</p>
          </div>
          <div className="subscription-badge">
            {user?.subscription?.type === 'premium' ? (
              <div className="premium-badge">
                <Crown size={16} />
                <span>Premium</span>
              </div>
            ) : (
              <div className="free-badge">
                <span>Free</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="dashboard-content">
        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">
              <Music size={24} />
            </div>
            <div className="stat-content">
              <h3>{stats?.totalPlaylists || 0}</h3>
              <p>Playlists Created</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <Heart size={24} />
            </div>
            <div className="stat-content">
              <h3>{stats?.totalLikedSongs || 0}</h3>
              <p>Liked Songs</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <Users size={24} />
            </div>
            <div className="stat-content">
              <h3>{stats?.totalFollowedArtists || 0}</h3>
              <p>Following Artists</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <Clock size={24} />
            </div>
            <div className="stat-content">
              <h3>{stats?.recentlyPlayedCount || 0}</h3>
              <p>Recently Played</p>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="main-content-grid">
          {/* User Info Card */}
          <div className="info-card user-info-card">
            <div className="card-header">
              <h2>Profile Information</h2>
              <Settings size={20} />
            </div>
            <div className="card-content">
              <div className="user-details">
                <div className="detail-row">
                  <span className="label">Username:</span>
                  <span className="value">@{user?.username}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Email:</span>
                  <span className="value">{user?.email}</span>
                </div>
                {user?.firstName && (
                  <div className="detail-row">
                    <span className="label">Name:</span>
                    <span className="value">{user.firstName} {user?.lastName}</span>
                  </div>
                )}
                <div className="detail-row">
                  <span className="label">Member Since:</span>
                  <span className="value">{formatDate(stats?.memberSince)}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Last Login:</span>
                  <span className="value">{formatDate(stats?.lastLogin)}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Account Status:</span>
                  <span className={`status ${user?.isVerified ? 'verified' : 'unverified'}`}>
                    {user?.isVerified ? 'Verified' : 'Unverified'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="info-card activity-card">
            <div className="card-header">
              <h2>Recent Activity</h2>
              <Activity size={20} />
            </div>
            <div className="card-content">
              {recentActivity && recentActivity.length > 0 ? (
                <div className="activity-list">
                  {recentActivity.map((activity, index) => (
                    <div key={index} className="activity-item">
                      <div className="activity-icon">
                        <Play size={16} />
                      </div>
                      <div className="activity-details">
                        <div className="activity-title">{activity.song?.title}</div>
                        <div className="activity-subtitle">{activity.song?.artist}</div>
                        <div className="activity-time">{formatDate(activity.playedAt)}</div>
                      </div>
                      <div className="activity-duration">
                        {formatDuration(activity.song?.duration)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-activity">
                  <Headphones size={48} />
                  <p>No recent activity</p>
                  <span>Start listening to see your activity here</span>
                </div>
              )}
            </div>
          </div>

          {/* Subscription Info */}
          <div className="info-card subscription-card">
            <div className="card-header">
              <h2>Subscription</h2>
              <Crown size={20} />
            </div>
            <div className="card-content">
              <div className="subscription-info">
                <div className="subscription-type">
                  <span className="type-label">Current Plan:</span>
                  <span className={`type-value ${stats?.subscriptionType}`}>
                    {stats?.subscriptionType === 'premium' ? 'Premium' : 'Free'}
                  </span>
                </div>
                {stats?.subscriptionType === 'premium' && stats?.subscriptionExpiry && (
                  <div className="subscription-expiry">
                    <span className="expiry-label">Expires:</span>
                    <span className="expiry-value">{formatDate(stats.subscriptionExpiry)}</span>
                  </div>
                )}
                <div className="subscription-features">
                  <h4>Your Benefits:</h4>
                  <ul>
                    {stats?.subscriptionType === 'premium' ? (
                      <>
                        <li>✓ Unlimited skips</li>
                        <li>✓ High quality audio</li>
                        <li>✓ Offline downloads</li>
                        <li>✓ No ads</li>
                        <li>✓ Unlimited playlists</li>
                      </>
                    ) : (
                      <>
                        <li>✓ Basic streaming</li>
                        <li>✓ Up to 10 playlists</li>
                        <li>✗ Limited skips</li>
                        <li>✗ Ads included</li>
                      </>
                    )}
                  </ul>
                </div>
                {stats?.subscriptionType === 'free' && (
                  <button className="upgrade-btn">
                    <Crown size={16} />
                    Upgrade to Premium
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="info-card actions-card">
            <div className="card-header">
              <h2>Quick Actions</h2>
              <TrendingUp size={20} />
            </div>
            <div className="card-content">
              <div className="quick-actions">
                <button className="action-btn">
                  <Music size={20} />
                  <span>Create Playlist</span>
                </button>
                <button className="action-btn">
                  <Heart size={20} />
                  <span>View Liked Songs</span>
                </button>
                <button className="action-btn">
                  <TrendingUp size={20} />
                  <span>Discover Music</span>
                </button>
                <button className="action-btn">
                  <Settings size={20} />
                  <span>Account Settings</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;