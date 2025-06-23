import axios from 'axios';

class SpotifyService {
    constructor() {
        this.clientId = process.env.SPOTIFY_CLIENT_ID;
        this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
        this.accessToken = null;
        this.tokenExpiresAt = 0;
    }

    async getAccessToken() {
        if (this.accessToken && this.tokenExpiresAt > Date.now()) {
            console.log('Using cached Spotify access token');
            return this.accessToken;
        }

        try {
            if (!this.clientId || !this.clientSecret) {
                throw new Error('Spotify client ID or secret not configured');
            }

            const authString = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
            console.log('Requesting new Spotify access token');

            const response = await axios.post(
                'https://accounts.spotify.com/api/token',
                'grant_type=client_credentials',
                {
                    headers: {
                        'Authorization': `Basic ${authString}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                }
            );

            this.accessToken = response.data.access_token;
            this.tokenExpiresAt = Date.now() + (response.data.expires_in * 1000) - 60000;
            console.log('Spotify access token obtained successfully');
            return this.accessToken;
        } catch (error) {
            console.error('Spotify token error:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status,
            });
            throw new Error('Failed to obtain Spotify access token');
        }
    }

    async makeRequest(url, params = {}) {
        try {
            const token = await this.getAccessToken();
            const response = await axios.get(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                params,
            });
            console.log(`Spotify API request to ${url} successful`, { params });
            return response.data;
        } catch (error) {
            console.error('Spotify API error:', {
                url,
                params,
                message: error.message,
                response: error.response?.data,
                status: error.response?.status,
            });
            throw error;
        }
    }

    async searchTracks(query, limit = 20, market = 'IN') {
        try {
            const url = 'https://api.spotify.com/v1/search';
            const params = {
                q: query,
                type: 'track',
                limit,
                market,
            };

            const data = await this.makeRequest(url, params);
            console.log('Spotify search results:', { query, total: data.tracks?.items?.length });
            return this.formatTracks(data.tracks.items || []);
        } catch (error) {
            console.error('Search tracks error:', error.message);
            throw error;
        }
    }

    async getTrack(trackId, market = 'IN') {
        try {
            const url = `https://api.spotify.com/v1/tracks/${trackId}`;
            const params = { market };

            const data = await this.makeRequest(url, params);
            console.log('Spotify track fetched:', { trackId });
            return this.formatTrack(data);
        } catch (error) {
            console.error('Get track error:', error.message);
            throw error;
        }
    }

    async getTrendingTracks(limit = 20, market = 'IN') {
        try {
            const playlistId = '4nqbYFYZOCospBb4miwHWy'; // Hot Hits Hindi
            const url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks`;
            const params = { limit, market };
            const data = await this.makeRequest(url, params);
            console.log('Trending tracks fetched:', { total: data.items?.length });
            return this.formatTracks(data.items.map(item => item.track).filter(track => track));
        } catch (error) {
            console.error('Trending tracks error:', error.message);
            throw error;
        }
    }

    async getNewReleases(limit = 20, market = 'IN') {
        try {
            const playlistId = '61ouNCQI2mMIikGAMJxskf'; // New Music Hindi
            const url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks`;
            const params = { limit, market };
            const data = await this.makeRequest(url, params);
            console.log('New releases fetched:', { total: data.items?.length });
            return this.formatTracks(data.items.map(item => item.track).filter(track => track));
        } catch (error) {
            console.error('New releases error:', error.message);
            throw error;
        }
    }

    formatTrack(track) {
        return {
            spotifyId: track.id,
            title: track.name || 'Unknown Title',
            artist: track.artists?.map(artist => artist.name).join(', ') || 'Unknown Artist',
            album: track.album?.name || 'Unknown Album',
            duration: track.duration_ms || 0,
            imageUrl: track.album?.images[0]?.url || null,
            releaseDate: track.album?.release_date ? new Date(track.album.release_date) : null,
            popularity: track.popularity || 0,
            explicit: track.explicit || false,
            previewUrl: track.preview_url || null,
            spotifyData: track,
        };
    }

    formatTracks(tracks) {
        return tracks.map(track => this.formatTrack(track));
    }
}

export default new SpotifyService();