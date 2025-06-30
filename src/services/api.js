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

      // Handle non-JSON responses
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        if (!response.ok) {
          throw {
            message: `HTTP ${response.status}: ${response.statusText}`,
            code: 'HTTP_ERROR',
            status: response.status
          };
        }
        return {};
      }

      const result = await response.json();

      if (!response.ok) {
        // Handle token expiration
        if (result.code === 'TOKEN_EXPIRED') {
          const refreshToken = localStorage.getItem('refreshToken');
          if (refreshToken) {
            try {
              const refreshResponse = await this.refreshToken(refreshToken);
              localStorage.setItem('token', refreshResponse.token);
              localStorage.setItem('refreshToken', refreshResponse.refreshToken);
              
              // Retry original request with new token
              return this.makeRequest(endpoint, {
                ...options,
                headers: {
                  ...options.headers,
                  Authorization: `Bearer ${refreshResponse.token}`
                }
              });
            } catch (refreshError) {
              // Refresh failed, redirect to login
              localStorage.removeItem('token');
              localStorage.removeItem('refreshToken');
              window.location.href = '/login';
              throw refreshError;
            }
          }
        }
        throw result;
      }

      return result;
    } catch (error) {
      // Handle network errors
      if (!error.message && !error.code) {
        throw {
          message: 'Network error occurred. Please check your connection.',
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

  async updateUserProfile(data) {
    return this.makeRequest('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
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

  async getNewReleases(limit = 20) {
    // For now, return trending songs as new releases
    // This can be updated when the backend supports new releases
    return this.makeRequest(`/music/database/trending?limit=${limit}`);
  },

  async searchMusic(query, limit = 20, offset = 0) {
    const params = new URLSearchParams({
      q: query,
      limit: limit.toString(),
      offset: offset.toString()
    });
    return this.makeRequest(`/music/search?${params}`);
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

  // User Library endpoints
  async getUserLibrary(limit = 50, skip = 0) {
    return this.makeRequest(`/music/user/library?limit=${limit}&skip=${skip}`);
  },

  async addToLibrary(spotifyId) {
    return this.makeRequest(`/music/${spotifyId}/library`, {
      method: 'POST',
    });
  },

  async removeFromLibrary(spotifyId) {
    return this.makeRequest(`/music/${spotifyId}/library`, {
      method: 'DELETE',
    });
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