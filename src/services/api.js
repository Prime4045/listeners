const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = localStorage.getItem('authToken');
  }

  // Set authentication token
  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('authToken', token);
    } else {
      localStorage.removeItem('authToken');
    }
  }

  // Get authentication headers
  getHeaders(contentType = 'application/json') {
    const headers = {
      'Content-Type': contentType,
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    return headers;
  }

  // Generic request method
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: this.getHeaders(options.contentType),
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // GET request
  async get(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    
    return this.request(url, {
      method: 'GET',
    });
  }

  // POST request
  async post(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // PUT request
  async put(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // DELETE request
  async delete(endpoint) {
    return this.request(endpoint, {
      method: 'DELETE',
    });
  }

  // POST with FormData (for file uploads)
  async postFormData(endpoint, formData) {
    return this.request(endpoint, {
      method: 'POST',
      body: formData,
      contentType: undefined, // Let browser set content-type for FormData
    });
  }

  // Authentication methods
  async register(userData) {
    const response = await this.post('/auth/register', userData);
    if (response.token) {
      this.setToken(response.token);
    }
    return response;
  }

  async login(credentials) {
    const response = await this.post('/auth/login', credentials);
    if (response.token) {
      this.setToken(response.token);
    }
    return response;
  }

  async logout() {
    try {
      await this.post('/auth/logout');
    } finally {
      this.setToken(null);
    }
  }

  async getCurrentUser() {
    return this.get('/auth/me');
  }

  async updateProfile(profileData) {
    return this.put('/auth/profile', profileData);
  }

  async changePassword(passwordData) {
    return this.put('/auth/change-password', passwordData);
  }

  // Music methods
  async getSongs(params = {}) {
    return this.get('/music', params);
  }

  async getTrendingSongs(limit = 20) {
    return this.get('/music/trending', { limit });
  }

  async getRecentSongs(limit = 20) {
    return this.get('/music/recent', { limit });
  }

  async getSong(id) {
    return this.get(`/music/${id}`);
  }

  async uploadSong(formData) {
    return this.postFormData('/music/upload', formData);
  }

  async updateSong(id, songData) {
    return this.put(`/music/${id}`, songData);
  }

  async deleteSong(id) {
    return this.delete(`/music/${id}`);
  }

  async likeSong(id) {
    return this.post(`/music/${id}/like`);
  }

  async trackPlay(id) {
    return this.post(`/music/${id}/play`);
  }

  // User methods
  async getRecentlyPlayed(limit = 20) {
    return this.get('/users/recently-played', { limit });
  }

  async getLikedSongs(params = {}) {
    return this.get('/users/liked-songs', params);
  }

  async getMySongs(params = {}) {
    return this.get('/users/my-songs', params);
  }

  async getUserProfile(identifier) {
    return this.get(`/users/${identifier}`);
  }

  async followUser(id) {
    return this.post(`/users/${id}/follow`);
  }

  async getUserFollowers(id, params = {}) {
    return this.get(`/users/${id}/followers`, params);
  }

  async getUserFollowing(id, params = {}) {
    return this.get(`/users/${id}/following`, params);
  }

  // Playlist methods
  async getPlaylists(params = {}) {
    return this.get('/playlists', params);
  }

  async getMyPlaylists(params = {}) {
    return this.get('/playlists/my-playlists', params);
  }

  async getPlaylist(id) {
    return this.get(`/playlists/${id}`);
  }

  async createPlaylist(playlistData) {
    return this.post('/playlists', playlistData);
  }

  async updatePlaylist(id, playlistData) {
    return this.put(`/playlists/${id}`, playlistData);
  }

  async deletePlaylist(id) {
    return this.delete(`/playlists/${id}`);
  }

  async addSongToPlaylist(playlistId, songId) {
    return this.post(`/playlists/${playlistId}/songs`, { songId });
  }

  async removeSongFromPlaylist(playlistId, songId) {
    return this.delete(`/playlists/${playlistId}/songs/${songId}`);
  }

  async followPlaylist(id) {
    return this.post(`/playlists/${id}/follow`);
  }

  // Health check
  async healthCheck() {
    return this.get('/health');
  }
}

// Create and export a singleton instance
const apiService = new ApiService();
export default apiService;