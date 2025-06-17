import axios from 'axios';

class ApiService {
  constructor() {
    // Use environment variable or fallback to localhost
    this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000, // 10 second timeout
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

    // Add response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
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
      console.error('API request failed:', {
        method,
        url,
        error: error.response?.data || error.message,
        status: error.response?.status
      });
<<<<<<< HEAD
      
=======

>>>>>>> 267ccd8 (Adding login and Registration form, Connecting cloudinary for songs)
      // Throw a more descriptive error
      const errorMessage = error.response?.data?.message || error.message || 'Request failed';
      throw new Error(errorMessage);
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
  async searchMusic(query, limit = 20) {
    return this.get('/music/search', { query, limit });
  }

  async getTrendingSongs(limit = 10) {
    return this.get('/music/trending-songs', { limit });
  }

  async getBollywoodAlbums(limit = 10) {
    return this.get('/music/bollywood-albums', { limit });
  }

  async getAlbumTrack(albumId) {
    return this.get(`/music/albums/${albumId}/track`);
  }

  async playTrack(songId) {
    return this.post(`/music/${songId}/play`);
  }

  async getSongDetails(songId) {
    return this.get(`/music/${songId}`);
  }

  // Auth methods
  async getCurrentUser() {
    return this.get('/auth/me');
  }

  async login(email, password) {
    return this.post('/auth/login', { email, password });
  }

  async register(username, email, password) {
    return this.post('/auth/register', { username, email, password });
  }

  async refreshToken(refreshToken) {
    return this.post('/auth/refresh-token', { refreshToken });
  }

  // Health check
  async healthCheck() {
    return this.get('/health');
  }
}

export default new ApiService();