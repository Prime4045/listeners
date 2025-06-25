const API_URL = import.meta.env.VITE_API_URL || 'https://work-2-kdvllvgyfifstacd.prod-runtime.all-hands.dev/api';

const ApiService = {
  async getCsrfToken() {
    try {
      const response = await fetch(`${API_URL}/csrf-token`, {
        credentials: 'include',
      });
      const data = await response.json();
      return data.csrfToken;
    } catch (error) {
      console.error('Failed to get CSRF token:', error);
      return null;
    }
  },

  async makeRequest(url, options = {}) {
    const token = localStorage.getItem('token');
    const csrfToken = await this.getCsrfToken();
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
    };

    const config = {
      credentials: 'include',
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
      ...options,
    };

    const response = await fetch(`${API_URL}${url}`, config);
    const result = await response.json();

    if (!response.ok) {
      throw result;
    }

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
    const token = localStorage.getItem('token');
    const csrfToken = await this.getCsrfToken();
    
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
      },
      body: formData,
      credentials: 'include',
    });

    const result = await response.json();
    if (!response.ok) {
      throw result;
    }
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