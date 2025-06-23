import axios from 'axios';

class ApiService {
  constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to include auth token
    this.axiosInstance.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling and token refresh
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const refreshToken = localStorage.getItem('refreshToken');
            if (refreshToken) {
              const response = await this.refreshToken(refreshToken);
              localStorage.setItem('token', response.token);
              localStorage.setItem('refreshToken', response.refreshToken);

              // Retry original request with new token
              originalRequest.headers.Authorization = `Bearer ${response.token}`;
              return this.axiosInstance(originalRequest);
            }
          } catch (refreshError) {
            // Refresh failed, redirect to login
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            window.location.href = '/login';
          }
        }

        return Promise.reject(this.formatError(error));
      }
    );
  }

  formatError(error) {
    if (error.response?.data) {
      return {
        message: error.response.data.message || 'Request failed',
        code: error.response.data.code,
        status: error.response.status,
        errors: error.response.data.errors,
      };
    }
    return {
      message: error.message || 'Network error',
      code: 'NETWORK_ERROR',
      status: 0,
    };
  }

  async request(method, url, data = null, headers = {}) {
    try {
      const response = await this.axiosInstance({
        method,
        url,
        data,
        headers,
      });
      return response.data;
    } catch (error) {
      throw this.formatError(error);
    }
  }

  async get(url, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const fullUrl = queryString ? `${url}?${queryString}` : url;
    return this.request('GET', fullUrl);
  }

  async post(url, data) {
    return this.request('POST', url, data);
  }

  async put(url, data) {
    return this.request('PUT', url, data);
  }

  async delete(url) {
    return this.request('DELETE', url);
  }

  // Music-specific methods

  // Get all songs from database (primary method)
  async getDatabaseSongs(page = 1, limit = 50, search = '') {
    const params = { page, limit };
    if (search) params.search = search;
    return this.get('/music/database/songs', params);
  }

  // Search music (database first, then Spotify)
  async searchMusic(query, limit = 20) {
    return this.get('/music/search', { query, limit });
  }

  // Get trending songs from database
  async getTrendingSongs(limit = 20) {
    return this.get('/music/database/trending', { limit });
  }

  // Play track (database first approach)
  async playTrack(spotifyId) {
    return this.post(`/music/${spotifyId}/play`);
  }

  // Get song details
  async getSongDetails(spotifyId) {
    return this.get(`/music/${spotifyId}`);
  }

  // Like/unlike track
  async likeTrack(spotifyId) {
    return this.post(`/music/${spotifyId}/like`);
  }

  // Get user's liked songs
  async getLikedSongs(limit = 50, skip = 0) {
    return this.get('/music/user/liked', { limit, skip });
  }

  // Auth methods
  async getCurrentUser() {
    return this.get('/auth/me');
  }

  async login(credentials) {
    return this.post('/auth/login', credentials);
  }

  async register(userData) {
    return this.post('/auth/register', userData);
  }

  async refreshToken(refreshToken) {
    return this.post('/auth/refresh-token', { refreshToken });
  }

  async logout() {
    const refreshToken = localStorage.getItem('refreshToken');
    return this.post('/auth/logout', { refreshToken });
  }

  // Health check
  async healthCheck() {
    return this.get('/health');
  }
}

export default new ApiService();