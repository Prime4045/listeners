const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const ApiService = {
  async getCsrfToken() {
    const response = await fetch(`${API_URL}/csrf-token`, {
      credentials: 'include',
    });
    const data = await response.json();
    return data.csrfToken;
  },

  async login(data) {
    const csrfToken = await this.getCsrfToken();
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      body: JSON.stringify(data),
      credentials: 'include',
    });

    const result = await response.json();
    if (!response.ok) {
      throw result;
    }
    return result;
  },

  async register(formData) {
    const csrfToken = await this.getCsrfToken();
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'X-CSRF-Token': csrfToken,
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
    const csrfToken = await this.getCsrfToken();
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-CSRF-Token': csrfToken,
      },
      body: JSON.stringify({ refreshToken }),
      credentials: 'include',
    });

    if (!response.ok) {
      throw await response.json();
    }
    return await response.json();
  },

  async getCurrentUser() {
    const token = localStorage.getItem('token');
    const csrfToken = await this.getCsrfToken();
    const response = await fetch(`${API_URL}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-CSRF-Token': csrfToken,
      },
      credentials: 'include',
    });

    const result = await response.json();
    if (!response.ok) {
      throw result;
    }
    return result;
  },

  async getDatabaseSongs(page, limit) {
    const token = localStorage.getItem('token');
    const csrfToken = await this.getCsrfToken();
    const response = await fetch(`${API_URL}/songs?page=${page}&limit=${limit}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-CSRF-Token': csrfToken,
      },
      credentials: 'include',
    });

    const result = await response.json();
    if (!response.ok) {
      throw result;
    }
    return result;
  },

  async getTrendingSongs(limit) {
    const token = localStorage.getItem('token');
    const csrfToken = await this.getCsrfToken();
    const response = await fetch(`${API_URL}/songs/trending?limit=${limit}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-CSRF-Token': csrfToken,
      },
      credentials: 'include',
    });

    const result = await response.json();
    if (!response.ok) {
      throw result;
    }
    return result;
  },

  async getLikedSongs() {
    const token = localStorage.getItem('token');
    const csrfToken = await this.getCsrfToken();
    const response = await fetch(`${API_URL}/songs/liked`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-CSRF-Token': csrfToken,
      },
      credentials: 'include',
    });

    const result = await response.json();
    if (!response.ok) {
      throw result;
    }
    return result;
  },

  async playTrack(spotifyId) {
    const token = localStorage.getItem('token');
    const csrfToken = await this.getCsrfToken();
    const response = await fetch(`${API_URL}/music/play/${spotifyId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-CSRF-Token': csrfToken,
      },
      credentials: 'include',
    });

    const result = await response.json();
    if (!response.ok) {
      throw result;
    }
    return result;
  },

  async searchMusic(query, limit) {
    const token = localStorage.getItem('token');
    const csrfToken = await this.getCsrfToken();
    const response = await fetch(`${API_URL}/music/search?q=${encodeURIComponent(query)}&limit=${limit}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-CSRF-Token': csrfToken,
      },
      credentials: 'include',
    });

    const result = await response.json();
    if (!response.ok) {
      throw result;
    }
    return result;
  },
};

export default ApiService;