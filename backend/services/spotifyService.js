import axios from 'axios';
import { redisClient } from '../config/database.js';

class SpotifyService {
    constructor() {
        this.clientId = process.env.SPOTIFY_CLIENT_ID;
        this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
        this.redirectUri = process.env.SPOTIFY_REDIRECT_URI;
        this.accessToken = null;
        this.tokenExpiresAt = 0;
        this.baseURL = 'https://api.spotify.com/v1';
        this.authURL = 'https://accounts.spotify.com/api/token';
        this.defaultMarket = 'IN'; // Changed default market to India
    }

    /**
     * Get client credentials access token
     */
    async getAccessToken() {
        if (this.accessToken && this.tokenExpiresAt > Date.now()) {
            return this.accessToken;
        }

        try {
            if (!this.clientId || !this.clientSecret) {
                throw new Error('Spotify client credentials not configured');
            }

            const authString = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

            const response = await axios.post(
                this.authURL,
                'grant_type=client_credentials',
                {
                    headers: {
                        'Authorization': `Basic ${authString}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    timeout: 10000,
                }
            );

            this.accessToken = response.data.access_token;
            this.tokenExpiresAt = Date.now() + (response.data.expires_in * 1000) - 60000;

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

    async makeRequest(endpoint, params = {}, retries = 3) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const token = await this.getAccessToken();
                const response = await axios.get(`${this.baseURL}${endpoint}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    params: { ...params, market: params.market || this.defaultMarket },
                    timeout: 15000,
                });
                return response.data;
            } catch (error) {
                console.error(`Spotify API error (attempt ${attempt}/${retries}):`, {
                    endpoint,
                    params,
                    message: error.message,
                    status: error.response?.status,
                    data: error.response?.data,
                });

                if (error.response?.status === 429) {
                    const retryAfter = parseInt(error.response.headers['retry-after']) || 1;
                    console.log(`Rate limited, waiting ${retryAfter} seconds...`);
                    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                    continue;
                }

                if (error.response?.status === 401) {
                    console.log('Token expired, refreshing...');
                    this.accessToken = null;
                    this.tokenExpiresAt = 0;
                    continue;
                }

                if (attempt === retries) {
                    throw error;
                }

                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
    }

    async searchTracks(query, limit = 20, market = this.defaultMarket) {
        try {
            const cacheKey = `spotify:search:${query.toLowerCase()}:${limit}:${market}`;

            const cached = await redisClient.get(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }

            const data = await this.makeRequest('/search', {
                q: query,
                type: 'track',
                limit,
                market,
            });

            const tracks = this.formatTracks(data.tracks?.items || []);

            await redisClient.setEx(cacheKey, 900, JSON.stringify(tracks));

            console.log('Spotify search results:', {
                query,
                total: tracks.length,
                market
            });

            return tracks;
        } catch (error) {
            console.error('Search tracks error:', error.message);
            throw new Error(`Failed to search tracks: ${error.message}`);
        }
    }

    async getTrack(trackId, market = this.defaultMarket) {
        try {
            const cacheKey = `spotify:track:${trackId}:${market}`;

            const cached = await redisClient.get(cacheKey);
            if (cached) {
                console.log('Returning cached Spotify track');
                return JSON.parse(cached);
            }

            const data = await this.makeRequest(`/tracks/${trackId}`, { market });
            const track = this.formatTrack(data);

            await redisClient.setEx(cacheKey, 86400, JSON.stringify(track));
            return track;
        } catch (error) {
            console.error('Get track error:', error.message);
            throw new Error(`Failed to get track: ${error.message}`);
        }
    }

    async getTrendingTracks(limit = 20, market = this.defaultMarket) {
        try {
            const cacheKey = `spotify:trending:${limit}:${market}`;
            const cached = await redisClient.get(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }

            // Use a specific playlist ID for trending tracks (e.g., Today's Top Hits)
            const playlistId = process.env.TODAYS_TOP_HITS_PLAYLIST_ID || '61ouNCQI2mMIikGAMJxskf'; // Default to Today's Top Hits
            const tracksData = await this.makeRequest(`/playlists/${playlistId}/tracks`, {
                limit,
                market,
            });

            const tracks = this.formatTracks(
                tracksData.items?.map(item => item.track).filter(track => track && track.id) || []
            );

            await redisClient.setEx(cacheKey, 3600, JSON.stringify(tracks));

            return tracks;
        } catch (error) {
            console.error('Get trending tracks error:', error.message);
            throw new Error(`Failed to load trending tracks: ${error.message}`);
        }
    }

    async getNewReleases(limit = 20, market = this.defaultMarket) {
        try {
            const cacheKey = `spotify:new_releases:${limit}:${market}`;
            const cached = await redisClient.get(cacheKey);

            if (cached) {
                console.log('Returning cached new releases');
                return JSON.parse(cached);
            }

            // Use a specific playlist ID for new releases (e.g., New Music Friday India)
            const playlistId = process.env.NEW_MUSIC_FRIDAY_PLAYLIST_ID || '61ouNCQI2mMIikGAMJxskf'; // Default to New Music Friday India
            const tracksData = await this.makeRequest(`/playlists/${playlistId}/tracks`, {
                limit,
                market,
            });

            const tracks = this.formatTracks(
                tracksData.items?.map(item => item.track).filter(track => track && track.id) || []
            );

            await redisClient.setEx(cacheKey, 7200, JSON.stringify(tracks));

            return tracks;
        } catch (error) {
            console.error('Get new releases error:', error.message);
            throw new Error(`Failed to get new releases: ${error.message}`);
        }
    }

    async searchBollywoodTracks(query = 'Bollywood', limit = 20, market = this.defaultMarket) {
        try {
            const enhancedQuery = `${query} genre:Bollywood`;
            return await this.searchTracks(enhancedQuery, limit, market);
        } catch (error) {
            throw new Error(`Failed to search Bollywood tracks: ${error.message}`);
        }
    }

    /**
     * Format single track data
     */
    formatTrack(track) {
        if (!track || !track.id) {
            return null;
        }

        return {
            spotifyId: track.id,
            title: track.name || 'Unknown Title',
            artist: track.artists?.map(artist => artist.name).join(', ') || 'Unknown Artist',
            album: track.album?.name || 'Unknown Album',
            duration: track.duration_ms || 0,
            imageUrl: track.album?.images?.[0]?.url || null,
            releaseDate: track.album?.release_date ? new Date(track.album.release_date) : null,
            popularity: track.popularity || 0,
            explicit: track.explicit || false,
            previewUrl: track.preview_url || null,
            externalUrls: track.external_urls || {},
            spotifyData: {
                id: track.id,
                uri: track.uri,
                href: track.href,
                type: track.type,
                track_number: track.track_number,
                disc_number: track.disc_number,
                available_markets: track.available_markets,
                is_local: track.is_local,
            },
        };
    }

    /**
     * Format multiple tracks
     */
    formatTracks(tracks) {
        return tracks
            .map(track => this.formatTrack(track))
            .filter(track => track !== null);
    }

    /**
     * Mock trending tracks for fallback
     */
    getMockTrendingTracks(limit = 20) {
        const mockTracks = [
            {
                spotifyId: '4uLU6hMCjMI75M1A2tKUQC',
                title: 'Blinding Lights',
                artist: 'The Weeknd',
                album: 'After Hours',
                duration: 200040,
                imageUrl: 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=300',
                popularity: 95,
                explicit: false,
                spotifyData: { id: '4uLU6hMCjMI75M1A2tKUQC' }
            },
            {
                spotifyId: '1mWdTewIgB3gtBM3TOSFhB',
                title: 'Watermelon Sugar',
                artist: 'Harry Styles',
                album: 'Fine Line',
                duration: 174000,
                imageUrl: 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=300',
                popularity: 90,
                explicit: false,
                spotifyData: { id: '1mWdTewIgB3gtBM3TOSFhB' }
            },
            {
                spotifyId: '5PUXKVVVQ74C3gl5vKy9Li',
                title: 'Heeriye (feat. Arijit Singh)',
                artist: 'Jasleen Royal, Arijit Singh',
                album: 'Heeriye',
                duration: 245000,
                imageUrl: 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=300',
                popularity: 85,
                explicit: false,
                spotifyData: { id: '5PUXKVVVQ74C3gl5vKy9Li' }
            },
            {
                spotifyId: '6WrI0LAC5M1Rw2MnX2ZvEg',
                title: 'Tum Hi Ho',
                artist: 'Arijit Singh',
                album: 'Aashiqui 2',
                duration: 262000,
                imageUrl: 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=300',
                popularity: 88,
                explicit: false,
                spotifyData: { id: '6WrI0LAC5M1Rw2MnX2ZvEg' }
            },
            {
                spotifyId: '1BxfuPKGuaTgP7aM0Bbdwr',
                title: 'Tera Ban Jaunga',
                artist: 'Akhil Sachdeva, Tulsi Kumar',
                album: 'Kabir Singh',
                duration: 234000,
                imageUrl: 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=300',
                popularity: 82,
                explicit: false,
                spotifyData: { id: '1BxfuPKGuaTgP7aM0Bbdwr' }
            },
            {
                spotifyId: '2YpeDb67231RjR0MgVLzsG',
                title: 'Kesariya',
                artist: 'Arijit Singh, Amitabh Bhattacharya',
                album: 'Brahmāstra',
                duration: 268000,
                imageUrl: 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=300',
                popularity: 90,
                explicit: false,
                spotifyData: { id: '2YpeDb67231RjR0MgVLzsG' }
            }
        ];
        
        return mockTracks.slice(0, limit);
    }

    getAuthorizationUrl(state = null) {
        const scopes = [
            'user-read-private',
            'user-read-email',
            'user-library-read',
            'user-library-modify',
            'playlist-read-private',
            'playlist-modify-public',
            'playlist-modify-private',
        ];

        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this.clientId,
            scope: scopes.join(' '),
            redirect_uri: this.redirectUri,
            ...(state && { state }),
        });

        return `https://accounts.spotify.com/authorize?${params.toString()}`;
    }

    async exchangeCodeForToken(code) {
        try {
            const response = await axios.post(
                this.authURL,
                new URLSearchParams({
                    grant_type: 'authorization_code',
                    code,
                    redirect_uri: this.redirectUri,
                    client_id: this.clientId,
                    client_secret: this.clientSecret,
                }),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                }
            );

            return response.data;
        } catch (error) {
            console.error('Token exchange error:', error.response?.data || error.message);
            throw new Error('Failed to exchange code for token');
        }
    }

    async healthCheck() {
        try {
            await this.getAccessToken();
            return { status: 'healthy', service: 'spotify' };
        } catch (error) {
            return {
                status: 'unhealthy',
                service: 'spotify',
                error: error.message
            };
        }
    }
}

export default new SpotifyService();