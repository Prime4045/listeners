import axios from 'axios';

class ApiService {
  constructor() {
    this.baseUrl = 'http://localhost:3001/api';
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async request(method, url, data = null, headers = {}) {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const response = await this.axiosInstance({
        method,
        url,
        data,
        headers,
      });
      return response.data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  async post(url, data) {
    return this.request('POST', url, data);
  }

  async trackPlay(songId) {
    return this.post(`/music/${songId}/play`);
  }
}

export default new ApiService();
