import React, { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Phone,
  Calendar,
  Camera,
  Save,
  X,
  Eye,
  EyeOff,
  Shield,
  Bell,
  Palette,
  Volume2,
  Loader2,
  AlertCircle,
  Check
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import ApiService from '../../services/api';
import './Profile.css';

const Profile = () => {
  const { user, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [profileData, setProfileData] = useState({
    username: '',
    firstName: '',
    lastName: '',
    profilePicture: null,
    preferences: {
      theme: 'dark',
      autoplay: true,
      quality: 'high',
      notifications: {
        email: true,
        push: true,
      },
      volumeSync: false,
    },
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [emailData, setEmailData] = useState({
    newEmail: '',
    password: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [profilePreview, setProfilePreview] = useState(null);

  useEffect(() => {
    if (user) {
      setProfileData({
        username: user.username || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        profilePicture: null,
        preferences: {
          theme: user.preferences?.theme || 'dark',
          autoplay: user.preferences?.autoplay ?? true,
          quality: user.preferences?.quality || 'high',
          notifications: {
            email: user.preferences?.notifications?.email ?? true,
            push: user.preferences?.notifications?.push ?? true,
          },
          volumeSync: user.preferences?.volumeSync ?? false,
        },
      });
      setEmailData({ ...emailData, newEmail: user.email || '' });
    }
  }, [user]);

  const handleProfileChange = (e) => {
    const { name, value, type, checked, files } = e.target;

    if (type === 'file') {
      const file = files[0];
      if (file) {
        if (file.size > 5 * 1024 * 1024) {
          setError('File size must be less than 5MB');
          return;
        }

        if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
          setError('Only JPG, JPEG, and PNG files are allowed');
          return;
        }

        setProfileData({ ...profileData, profilePicture: file });
        const reader = new FileReader();
        reader.onload = (e) => setProfilePreview(e.target.result);
        reader.readAsDataURL(file);
      }
    } else if (name.includes('.')) {
      const [parent, child, grandchild] = name.split('.');
      setProfileData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: grandchild ? {
            ...prev[parent][child],
            [grandchild]: type === 'checkbox' ? checked : value
          } : type === 'checkbox' ? checked : value
        }
      }));
    } else {
      setProfileData({
        ...profileData,
        [name]: type === 'checkbox' ? checked : value,
      });
    }
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData({ ...passwordData, [name]: value });
  };

  const handleEmailChange = (e) => {
    const { name, value } = e.target;
    setEmailData({ ...emailData, [name]: value });
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      
      // Add text fields
      Object.keys(profileData).forEach(key => {
        if (key === 'profilePicture') {
          if (profileData[key]) {
            formData.append(key, profileData[key]);
          }
        } else if (key === 'preferences') {
          formData.append(key, JSON.stringify(profileData[key]));
        } else {
          formData.append(key, profileData[key]);
        }
      });

      const response = await ApiService.updateUserProfile(formData);
      updateUser(response.user);
      setSuccess('Profile updated successfully!');
    } catch (err) {
      console.error('Profile update error:', err);
      setError(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New passwords do not match');
      setLoading(false);
      return;
    }

    try {
      await ApiService.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
        confirmPassword: passwordData.confirmPassword,
      });
      setSuccess('Password changed successfully!');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (err) {
      console.error('Password change error:', err);
      setError(err.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await ApiService.changeEmail({
        newEmail: emailData.newEmail,
        password: emailData.password,
      });
      setSuccess('Email change request sent! Please check your new email for verification.');
      setEmailData({ newEmail: '', password: '' });
    } catch (err) {
      console.error('Email change error:', err);
      setError(err.message || 'Failed to change email');
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = (field) => {
    setShowPasswords({
      ...showPasswords,
      [field]: !showPasswords[field],
    });
  };

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  return (
    <div className="profile-page">
      <div className="profile-header">
        <h1>Account Settings</h1>
        <p>Manage your profile and account preferences</p>
      </div>

      <div className="profile-container">
        <div className="profile-sidebar">
          <nav className="profile-nav">
            <button
              className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              <User size={20} />
              <span>Profile</span>
            </button>
            <button
              className={`nav-item ${activeTab === 'security' ? 'active' : ''}`}
              onClick={() => setActiveTab('security')}
            >
              <Shield size={20} />
              <span>Security</span>
            </button>
            <button
              className={`nav-item ${activeTab === 'preferences' ? 'active' : ''}`}
              onClick={() => setActiveTab('preferences')}
            >
              <Palette size={20} />
              <span>Preferences</span>
            </button>
          </nav>
        </div>

        <div className="profile-content">
          {/* Messages */}
          {(error || success) && (
            <div className={`message ${error ? 'error' : 'success'}`}>
              {error ? <AlertCircle size={16} /> : <Check size={16} />}
              <span>{error || success}</span>
              <button onClick={clearMessages}>
                <X size={16} />
              </button>
            </div>
          )}

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="tab-content">
              <div className="tab-header">
                <h2>Profile Information</h2>
                <p>Update your personal information and profile picture</p>
              </div>

              <form onSubmit={handleProfileSubmit} className="profile-form">
                <div className="form-section">
                  <h3>Profile Picture</h3>
                  <div className="profile-picture-section">
                    <div className="profile-picture-preview">
                      {profilePreview || user?.profilePicture ? (
                        <img
                          src={profilePreview || user.profilePicture}
                          alt="Profile"
                        />
                      ) : (
                        <User size={48} />
                      )}
                    </div>
                    <div className="profile-picture-controls">
                      <input
                        type="file"
                        id="profilePicture"
                        name="profilePicture"
                        accept="image/jpeg,image/jpg,image/png"
                        onChange={handleProfileChange}
                        className="file-input"
                      />
                      <label htmlFor="profilePicture" className="upload-btn">
                        <Camera size={16} />
                        Change Photo
                      </label>
                      <p className="upload-hint">Max 5MB, JPG/PNG only</p>
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h3>Personal Information</h3>
                  <div className="form-grid">
                    <div className="form-group">
                      <label htmlFor="username">Username</label>
                      <div className="input-wrapper">
                        <User className="input-icon" size={18} />
                        <input
                          type="text"
                          id="username"
                          name="username"
                          value={profileData.username}
                          onChange={handleProfileChange}
                          placeholder="Enter username"
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label htmlFor="firstName">First Name</label>
                      <div className="input-wrapper">
                        <User className="input-icon" size={18} />
                        <input
                          type="text"
                          id="firstName"
                          name="firstName"
                          value={profileData.firstName}
                          onChange={handleProfileChange}
                          placeholder="Enter first name"
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label htmlFor="lastName">Last Name</label>
                      <div className="input-wrapper">
                        <User className="input-icon" size={18} />
                        <input
                          type="text"
                          id="lastName"
                          name="lastName"
                          value={profileData.lastName}
                          onChange={handleProfileChange}
                          placeholder="Enter last name"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="form-actions">
                  <button type="submit" className="save-btn" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="tab-content">
              <div className="tab-header">
                <h2>Security Settings</h2>
                <p>Manage your password and email address</p>
              </div>

              <div className="security-sections">
                {/* Change Password */}
                <div className="security-section">
                  <h3>Change Password</h3>
                  <form onSubmit={handlePasswordSubmit} className="security-form">
                    <div className="form-group">
                      <label htmlFor="currentPassword">Current Password</label>
                      <div className="input-wrapper">
                        <Shield className="input-icon" size={18} />
                        <input
                          type={showPasswords.current ? 'text' : 'password'}
                          id="currentPassword"
                          name="currentPassword"
                          value={passwordData.currentPassword}
                          onChange={handlePasswordChange}
                          placeholder="Enter current password"
                        />
                        <button
                          type="button"
                          className="password-toggle"
                          onClick={() => togglePasswordVisibility('current')}
                        >
                          {showPasswords.current ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    <div className="form-group">
                      <label htmlFor="newPassword">New Password</label>
                      <div className="input-wrapper">
                        <Shield className="input-icon" size={18} />
                        <input
                          type={showPasswords.new ? 'text' : 'password'}
                          id="newPassword"
                          name="newPassword"
                          value={passwordData.newPassword}
                          onChange={handlePasswordChange}
                          placeholder="Enter new password"
                        />
                        <button
                          type="button"
                          className="password-toggle"
                          onClick={() => togglePasswordVisibility('new')}
                        >
                          {showPasswords.new ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    <div className="form-group">
                      <label htmlFor="confirmPassword">Confirm New Password</label>
                      <div className="input-wrapper">
                        <Shield className="input-icon" size={18} />
                        <input
                          type={showPasswords.confirm ? 'text' : 'password'}
                          id="confirmPassword"
                          name="confirmPassword"
                          value={passwordData.confirmPassword}
                          onChange={handlePasswordChange}
                          placeholder="Confirm new password"
                        />
                        <button
                          type="button"
                          className="password-toggle"
                          onClick={() => togglePasswordVisibility('confirm')}
                        >
                          {showPasswords.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    <button type="submit" className="save-btn" disabled={loading}>
                      {loading ? (
                        <>
                          <Loader2 className="animate-spin" size={16} />
                          Changing...
                        </>
                      ) : (
                        'Change Password'
                      )}
                    </button>
                  </form>
                </div>

                {/* Change Email */}
                <div className="security-section">
                  <h3>Change Email Address</h3>
                  <div className="current-email">
                    <p>Current email: <strong>{user?.email}</strong></p>
                  </div>
                  <form onSubmit={handleEmailSubmit} className="security-form">
                    <div className="form-group">
                      <label htmlFor="newEmail">New Email Address</label>
                      <div className="input-wrapper">
                        <Mail className="input-icon" size={18} />
                        <input
                          type="email"
                          id="newEmail"
                          name="newEmail"
                          value={emailData.newEmail}
                          onChange={handleEmailChange}
                          placeholder="Enter new email address"
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label htmlFor="password">Confirm Password</label>
                      <div className="input-wrapper">
                        <Shield className="input-icon" size={18} />
                        <input
                          type="password"
                          id="password"
                          name="password"
                          value={emailData.password}
                          onChange={handleEmailChange}
                          placeholder="Enter your password"
                        />
                      </div>
                    </div>

                    <button type="submit" className="save-btn" disabled={loading}>
                      {loading ? (
                        <>
                          <Loader2 className="animate-spin" size={16} />
                          Changing...
                        </>
                      ) : (
                        'Change Email'
                      )}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Preferences Tab */}
          {activeTab === 'preferences' && (
            <div className="tab-content">
              <div className="tab-header">
                <h2>Preferences</h2>
                <p>Customize your listening experience</p>
              </div>

              <form onSubmit={handleProfileSubmit} className="preferences-form">
                <div className="preferences-section">
                  <h3>Appearance</h3>
                  <div className="preference-item">
                    <div className="preference-info">
                      <label>Theme</label>
                      <p>Choose your preferred color scheme</p>
                    </div>
                    <select
                      name="preferences.theme"
                      value={profileData.preferences.theme}
                      onChange={handleProfileChange}
                      className="preference-select"
                    >
                      <option value="dark">Dark</option>
                      <option value="light">Light</option>
                    </select>
                  </div>
                </div>

                <div className="preferences-section">
                  <h3>Playback</h3>
                  <div className="preference-item">
                    <div className="preference-info">
                      <label>Autoplay</label>
                      <p>Automatically play similar songs when your music ends</p>
                    </div>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        name="preferences.autoplay"
                        checked={profileData.preferences.autoplay}
                        onChange={handleProfileChange}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>

                  <div className="preference-item">
                    <div className="preference-info">
                      <label>Audio Quality</label>
                      <p>Higher quality uses more data</p>
                    </div>
                    <select
                      name="preferences.quality"
                      value={profileData.preferences.quality}
                      onChange={handleProfileChange}
                      className="preference-select"
                    >
                      <option value="low">Low (96 kbps)</option>
                      <option value="medium">Medium (160 kbps)</option>
                      <option value="high">High (320 kbps)</option>
                    </select>
                  </div>

                  <div className="preference-item">
                    <div className="preference-info">
                      <label>Volume Sync</label>
                      <p>Sync volume across all your devices</p>
                    </div>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        name="preferences.volumeSync"
                        checked={profileData.preferences.volumeSync}
                        onChange={handleProfileChange}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>

                <div className="preferences-section">
                  <h3>Notifications</h3>
                  <div className="preference-item">
                    <div className="preference-info">
                      <label>Email Notifications</label>
                      <p>Receive updates about new features and releases</p>
                    </div>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        name="preferences.notifications.email"
                        checked={profileData.preferences.notifications.email}
                        onChange={handleProfileChange}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>

                  <div className="preference-item">
                    <div className="preference-info">
                      <label>Push Notifications</label>
                      <p>Get notified about new music and updates</p>
                    </div>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        name="preferences.notifications.push"
                        checked={profileData.preferences.notifications.push}
                        onChange={handleProfileChange}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>

                <div className="form-actions">
                  <button type="submit" className="save-btn" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        Save Preferences
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;