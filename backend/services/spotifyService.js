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
    }

    /**
     * Get client credentials access token
     */
    async getAccessToken() {
        if (this.accessToken && this.tokenExpiresAt > Date.now()) {
            console.log('Using cached Spotify access token');
            return this.accessToken;
        }

        try {
            if (!this.clientId || !this.clientSecret) {
                throw new Error('Spotify client credentials not configured');
            }

            const authString = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
            console.log('Requesting new Spotify access token');

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
            this.tokenExpiresAt = Date.now() + (response.data.expires_in * 1000) - 60000; // 1 min buffer

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

    /**
     * Make authenticated request to Spotify API with retry logic
     */
    async makeRequest(endpoint, params = {}, retries = 3) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const token = await this.getAccessToken();
                const response = await axios.get(`${this.baseURL}${endpoint}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    params,
                    timeout: 15000,
                });

                console.log(`Spotify API request successful: ${endpoint}`, { 
                    params, 
                    status: response.status 
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

                // Handle rate limiting
                if (error.response?.status === 429) {
                    const retryAfter = parseInt(error.response.headers['retry-after']) || 1;
                    console.log(`Rate limited, waiting ${retryAfter} seconds...`);
                    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                    continue;
                }

                // Handle token expiration
                if (error.response?.status === 401) {
                    console.log('Token expired, refreshing...');
                    this.accessToken = null;
                    this.tokenExpiresAt = 0;
                    continue;
                }

                // If it's the last attempt, throw the error
                if (attempt === retries) {
                    throw error;
                }

                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
    }

    /**
     * Search for tracks with caching
     */
    async searchTracks(query, limit = 20, market = 'IN,US,GB') {
        try {
            const cacheKey = `spotify:search:${query.toLowerCase()}:${limit}:${market}`;
            
            // Check cache first
            const cached = await redisClient.get(cacheKey);
            if (cached) {
                console.log('Returning cached Spotify search results');
                return JSON.parse(cached);
            }

            // Try to search with specific market first
            let data;
            try {
                data = await this.makeRequest('/search', {
                    q: query,
                    type: 'track',
                    limit,
                    market: 'IN',
                    include_external: 'audio'
                });
            } catch (err) {
                console.error('Error searching with IN market:', err.message);
                // Fallback to global search
                data = await this.makeRequest('/search', {
                    q: query,
                    type: 'track',
                    limit,
                    market: 'US',
                    include_external: 'audio'
                });
            }

            // If no results, try with a broader search
            if (!data.tracks?.items?.length) {
                console.log('No results found, trying broader search');
                data = await this.makeRequest('/search', {
                    q: query,
                    type: 'track',
                    limit: limit * 2, // Get more results to filter
                    include_external: 'audio'
                });
            }

            // If still no results and query might be a playlist URL, try to extract playlist ID
            if (!data.tracks?.items?.length && query.includes('spotify.com/playlist/')) {
                try {
                    const playlistIdMatch = query.match(/playlist\/([a-zA-Z0-9]+)/);
                    if (playlistIdMatch && playlistIdMatch[1]) {
                        const playlistId = playlistIdMatch[1];
                        console.log(`Detected playlist ID: ${playlistId}, fetching tracks`);
                        
                        const playlistData = await this.makeRequest(`/playlists/${playlistId}/tracks`, {
                            limit,
                            market: 'IN,US'
                        });
                        
                        const playlistTracks = playlistData.items
                            ?.map(item => item.track)
                            .filter(track => track && track.id) || [];
                            
                        const tracks = this.formatTracks(playlistTracks);
                        
                        // Cache results for 15 minutes
                        await redisClient.setEx(cacheKey, 900, JSON.stringify(tracks));
                        
                        console.log('Playlist tracks fetched:', { 
                            playlistId, 
                            total: tracks.length
                        });
                        
                        return tracks;
                    }
                } catch (err) {
                    console.error('Error fetching playlist tracks:', err.message);
                }
            }

            const tracks = this.formatTracks(data.tracks?.items || []);
            
            // Cache results for 15 minutes
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

    /**
     * Get track by ID with caching
     */
    async getTrack(trackId, market = 'US') {
        try {
            const cacheKey = `spotify:track:${trackId}:${market}`;
            
            // Check cache first
            const cached = await redisClient.get(cacheKey);
            if (cached) {
                console.log('Returning cached Spotify track');
                return JSON.parse(cached);
            }

            const data = await this.makeRequest(`/tracks/${trackId}`, { market });
            const track = this.formatTrack(data);
            
            // Cache for 24 hours
            await redisClient.setEx(cacheKey, 86400, JSON.stringify(track));
            
            console.log('Spotify track fetched:', { trackId, market });
            return track;
        } catch (error) {
            console.error('Get track error:', error.message);
            throw new Error(`Failed to get track: ${error.message}`);
        }
    }

    /**
     * Get trending tracks from featured playlists
     */
    async getTrendingTracks(limit = 20, market = 'IN,US,GB') {
        try {
            const cacheKey = `spotify:trending:${limit}:${market}`;
            
            // Check cache first
            const cached = await redisClient.get(cacheKey);
            if (cached) {
                console.log('Returning cached trending tracks');
                return JSON.parse(cached);
            }

            // Get multiple playlists to ensure diversity
            const playlistsData = await this.makeRequest('/browse/featured-playlists', {
                limit: 10,
                market: 'IN',
                locale: 'en_IN'
            });

            if (!playlistsData.playlists?.items?.length) {
                return [];
            }

            // Get tracks from multiple playlists for diversity
            let allTracks = [];
            const playlistsToFetch = Math.min(3, playlistsData.playlists.items.length);
            
            for (let i = 0; i < playlistsToFetch; i++) {
                const playlist = playlistsData.playlists.items[i];
                console.log(`Fetching tracks from playlist: ${playlist.name} (${playlist.id})`);
                
                try {
                    const tracksData = await this.makeRequest(`/playlists/${playlist.id}/tracks`, {
                        limit: Math.ceil(limit / playlistsToFetch),
                        market: 'IN'
                    });
                    
                    const playlistTracks = tracksData.items
                        ?.map(item => item.track)
                        .filter(track => track && track.id) || [];
                        
                    allTracks = [...allTracks, ...playlistTracks];
                } catch (err) {
                    console.error(`Error fetching tracks from playlist ${playlist.id}:`, err.message);
                    // Continue with other playlists if one fails
                }
            }
            
            // If we couldn't get tracks from playlists, try global top tracks
            if (allTracks.length === 0) {
                console.log('Falling back to global top tracks');
                const topTracksData = await this.makeRequest('/playlists/37i9dQZEVXbMDoHDwVN2tF/tracks', {
                    limit,
                    market: 'US'
                });
                
                allTracks = topTracksData.items
                    ?.map(item => item.track)
                    .filter(track => track && track.id) || [];
            }
            
            // Deduplicate tracks
            const uniqueTracks = Array.from(new Map(
                allTracks.map(track => [track.id, track])
            ).values());
            
            const tracks = this.formatTracks(uniqueTracks.slice(0, limit));
            
            // Cache for 1 hour
            await redisClient.setEx(cacheKey, 3600, JSON.stringify(tracks));
            
            console.log('Trending tracks fetched:', { total: tracks.length, market });
            return tracks;
        } catch (error) {
            console.error('Get trending tracks error:', error.message);
            throw new Error(`Failed to get trending tracks: ${error.message}`);
        }
    }

    /**
     * Get new releases
     */
    async getNewReleases(limit = 20, market = 'US') {
        try {
            const cacheKey = `spotify:new_releases:${limit}:${market}`;
            
            // Check cache first
            const cached = await redisClient.get(cacheKey);
            if (cached) {
                console.log('Returning cached new releases');
                return JSON.parse(cached);
            }

            const data = await this.makeRequest('/browse/new-releases', {
                limit,
                market,
            });

            // Get tracks from albums
            const albums = data.albums?.items || [];
            const tracks = [];

            for (const album of albums.slice(0, Math.ceil(limit / 2))) {
                try {
                    const albumTracks = await this.makeRequest(`/albums/${album.id}/tracks`, {
                        limit: 2,
                        market,
                    });

                    const formattedTracks = albumTracks.items?.map(track => ({
                        ...this.formatTrack(track),
                        album: album.name,
                        imageUrl: album.images?.[0]?.url,
                        releaseDate: album.release_date,
                    })) || [];

                    tracks.push(...formattedTracks);
                } catch (err) {
                    console.error(`Error fetching album tracks for ${album.id}:`, err.message);
                }
            }

            const limitedTracks = tracks.slice(0, limit);
            
            // Cache for 2 hours
            await redisClient.setEx(cacheKey, 7200, JSON.stringify(limitedTracks));
            
            console.log('New releases fetched:', { total: limitedTracks.length, market });
            return limitedTracks;
        } catch (error) {
            console.error('Get new releases error:', error.message);
            throw new Error(`Failed to get new releases: ${error.message}`);
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
     * Get user's OAuth authorization URL
     */
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

    /**
     * Exchange authorization code for access token
     */
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

    /**
     * Health check for Spotify API
     */
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

    /**
     * Get featured playlists
     */
    async getFeaturedPlaylists(limit = 10, market = 'IN,US,GB') {
        try {
            const cacheKey = `spotify:featured_playlists:${limit}:${market}`;
            
            // Check cache first
            const cached = await redisClient.get(cacheKey);
            if (cached) {
                console.log('Returning cached featured playlists');
                return JSON.parse(cached);
            }

            // Try to get featured playlists with specific market first
            let playlistsData;
            try {
                playlistsData = await this.makeRequest('/browse/featured-playlists', {
                    limit,
                    market: 'IN',
                    locale: 'en_IN'
                });
            } catch (err) {
                console.error('Error fetching IN featured playlists:', err.message);
                // Fallback to global playlists
                playlistsData = await this.makeRequest('/browse/featured-playlists', {
                    limit,
                    market: 'US'
                });
            }

            if (!playlistsData.playlists?.items?.length) {
                return [];
            }

            const playlists = playlistsData.playlists.items.map(playlist => ({
                id: playlist.id,
                name: playlist.name,
                description: playlist.description,
                imageUrl: playlist.images?.[0]?.url,
                tracksTotal: playlist.tracks?.total || 0,
                owner: playlist.owner?.display_name,
                externalUrl: playlist.external_urls?.spotify,
                uri: playlist.uri
            }));
            
            // Cache for 2 hours
            await redisClient.setEx(cacheKey, 7200, JSON.stringify(playlists));
            
            console.log('Featured playlists fetched:', { total: playlists.length });
            return playlists;
        } catch (error) {
            console.error('Get featured playlists error:', error.message);
            throw new Error(`Failed to get featured playlists: ${error.message}`);
        }
    }

    /**
     * Get playlist by ID
     */
    async getPlaylist(playlistId, limit = 50, market = 'IN,US') {
        try {
            const cacheKey = `spotify:playlist:${playlistId}:${limit}:${market}`;
            
            // Check cache first
            const cached = await redisClient.get(cacheKey);
            if (cached) {
                console.log('Returning cached playlist');
                return JSON.parse(cached);
            }

            const playlistData = await this.makeRequest(`/playlists/${playlistId}`, {
                market: 'IN,US'
            });

            if (!playlistData) {
                throw new Error('Playlist not found');
            }

            // Get tracks with pagination if needed
            let allTracks = playlistData.tracks?.items || [];
            let nextUrl = playlistData.tracks?.next;
            
            while (nextUrl && allTracks.length < limit) {
                const nextUrlPath = nextUrl.replace('https://api.spotify.com/v1', '');
                const moreTracksData = await this.makeRequest(nextUrlPath);
                allTracks = [...allTracks, ...(moreTracksData.items || [])];
                nextUrl = moreTracksData.next;
            }

            // Format tracks
            const tracks = this.formatTracks(
                allTracks
                    .map(item => item.track)
                    .filter(track => track && track.id)
                    .slice(0, limit)
            );

            const playlist = {
                id: playlistData.id,
                name: playlistData.name,
                description: playlistData.description,
                imageUrl: playlistData.images?.[0]?.url,
                tracksTotal: playlistData.tracks?.total || 0,
                owner: playlistData.owner?.display_name,
                externalUrl: playlistData.external_urls?.spotify,
                uri: playlistData.uri,
                tracks
            };
            
            // Cache for 1 hour
            await redisClient.setEx(cacheKey, 3600, JSON.stringify(playlist));
            
            console.log('Playlist fetched:', { 
                playlistId, 
                name: playlist.name,
                trackCount: tracks.length 
            });
            
            return playlist;
        } catch (error) {
            console.error('Get playlist error:', error.message);
            throw new Error(`Failed to get playlist: ${error.message}`);
        }
    }

    /**
     * Get categories
     */
    async getCategories(limit = 20, market = 'IN,US') {
        try {
            const cacheKey = `spotify:categories:${limit}:${market}`;
            
            // Check cache first
            const cached = await redisClient.get(cacheKey);
            if (cached) {
                console.log('Returning cached categories');
                return JSON.parse(cached);
            }

            const data = await this.makeRequest('/browse/categories', {
                limit,
                country: 'IN',
                locale: 'en_IN'
            });

            if (!data.categories?.items?.length) {
                return [];
            }

            const categories = data.categories.items.map(category => ({
                id: category.id,
                name: category.name,
                imageUrl: category.icons?.[0]?.url
            }));
            
            // Cache for 24 hours
            await redisClient.setEx(cacheKey, 86400, JSON.stringify(categories));
            
            console.log('Categories fetched:', { total: categories.length });
            return categories;
        } catch (error) {
            console.error('Get categories error:', error.message);
            throw new Error(`Failed to get categories: ${error.message}`);
        }
    }

    /**
     * Get category playlists
     */
    async getCategoryPlaylists(categoryId, limit = 10, market = 'IN,US') {
        try {
            const cacheKey = `spotify:category_playlists:${categoryId}:${limit}:${market}`;
            
            // Check cache first
            const cached = await redisClient.get(cacheKey);
            if (cached) {
                console.log('Returning cached category playlists');
                return JSON.parse(cached);
            }

            const data = await this.makeRequest(`/browse/categories/${categoryId}/playlists`, {
                limit,
                country: 'IN'
            });

            if (!data.playlists?.items?.length) {
                return [];
            }

            const playlists = data.playlists.items.map(playlist => ({
                id: playlist.id,
                name: playlist.name,
                description: playlist.description,
                imageUrl: playlist.images?.[0]?.url,
                tracksTotal: playlist.tracks?.total || 0,
                owner: playlist.owner?.display_name,
                externalUrl: playlist.external_urls?.spotify,
                uri: playlist.uri
            }));
            
            // Cache for 6 hours
            await redisClient.setEx(cacheKey, 21600, JSON.stringify(playlists));
            
            console.log('Category playlists fetched:', { 
                categoryId, 
                total: playlists.length 
            });
            
            return playlists;
        } catch (error) {
            console.error('Get category playlists error:', error.message);
            throw new Error(`Failed to get category playlists: ${error.message}`);
        }
    }
}

export default new SpotifyService();