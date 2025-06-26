const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const ApiService = {
  async makeRequest(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
        credentials: 'include',
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw result;
      }
      
      return result;
    } catch (error) {
      // Handle network errors
      if (!error.message) {
        throw {
          message: 'Network error occurred',
          code: 'NETWORK_ERROR',
          status: 0
        };
      }
      throw error;
    }
  },

  // Authentication endpoints
  async login(data) {
    return this.makeRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async register(formData) {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
      headers: {
        ...(localStorage.getItem('token') && { 
          Authorization: `Bearer ${localStorage.getItem('token')}` 
        }),
      },
    });
    
    const result = await response.json();
    if (!response.ok) throw result;
    return result;
  },

  async logout(refreshToken) {
    return this.makeRequest('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  },

  async getCurrentUser() {
    return this.makeRequest('/auth/me');
  },

  async refreshToken(refreshToken) {
    return this.makeRequest('/auth/refresh-token', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  },

  // User profile endpoints
  async getUserProfile() {
    return this.makeRequest('/users/profile');
  },

  async updateUserProfile(formData) {
    const response = await fetch(`${API_URL}/users/profile`, {
      method: 'PUT',
      body: formData,
      credentials: 'include',
      headers: {
        ...(localStorage.getItem('token') && { 
          Authorization: `Bearer ${localStorage.getItem('token')}` 
        }),
      },
    });
    
    const result = await response.json();
    if (!response.ok) throw result;
    return result;
  },

  async changePassword(data) {
    return this.makeRequest('/users/change-password', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async changeEmail(data) {
    return this.makeRequest('/users/change-email', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async getUserDashboard() {
    return this.makeRequest('/users/dashboard');
  },

  async deleteAccount(password) {
    return this.makeRequest('/users/account', {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    });
  },

  // Music endpoints
  async getDatabaseSongs(page = 1, limit = 50) {
    return this.makeRequest(`/music/database/songs?page=${page}&limit=${limit}`);
  },

  async getTrendingSongs(limit = 20) {
    return this.makeRequest(`/music/database/trending?limit=${limit}`);
  },

  async searchMusic(query, limit = 20) {
    return this.makeRequest(`/music/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  },

  async playTrack(spotifyId, playData = {}) {
    return this.makeRequest(`/music/${spotifyId}/play`, {
      method: 'POST',
      body: JSON.stringify(playData),
    });
  },

  async getTrackDetails(spotifyId) {
    return this.makeRequest(`/music/${spotifyId}`);
  },

  async likeTrack(spotifyId) {
    return this.makeRequest(`/music/${spotifyId}/like`, {
      method: 'POST',
    });
  },

  async getLikedSongs(limit = 50, skip = 0) {
    return this.makeRequest(`/music/user/liked?limit=${limit}&skip=${skip}`);
  },

  async getPlayHistory(limit = 50) {
    return this.makeRequest(`/music/user/history?limit=${limit}`);
  },

  // Health check
  async healthCheck() {
    return this.makeRequest('/music/health');
  },

  // Generic methods
  async get(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    return this.makeRequest(url);
  },

  async post(endpoint, data = {}) {
    return this.makeRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async put(endpoint, data = {}) {
    return this.makeRequest(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async delete(endpoint) {
    return this.makeRequest(endpoint, {
      method: 'DELETE',
    });
  },
};

export default ApiService;