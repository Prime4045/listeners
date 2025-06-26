const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const ApiService = {
  async makeRequest(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    const result = await response.json();
    if (!response.ok) throw result;
    return result;
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

  // Spotify Playlists
  async getFeaturedPlaylists(limit = 10) {
    return this.makeRequest(`/music/spotify/featured-playlists?limit=${limit}`);
  },

  async getPlaylistById(playlistId, limit = 50) {
    return this.makeRequest(`/music/spotify/playlists/${playlistId}?limit=${limit}`);
  },

  async getCategories(limit = 20) {
    return this.makeRequest(`/music/spotify/categories?limit=${limit}`);
  },

  async getCategoryPlaylists(categoryId, limit = 10) {
    return this.makeRequest(`/music/spotify/categories/${categoryId}/playlists?limit=${limit}`);
  },

  // Health check
  async healthCheck() {
    return this.makeRequest('/music/health');
  },

  // Generic GET request
  async get(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    return this.makeRequest(url);
  },

  // Generic POST request
  async post(endpoint, data = {}) {
    return this.makeRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Generic PUT request
  async put(endpoint, data = {}) {
    return this.makeRequest(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Generic DELETE request
  async delete(endpoint) {
    return this.makeRequest(endpoint, {
      method: 'DELETE',
    });
  },
};

export default ApiService;
