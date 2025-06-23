# 🎵 Listeners - Music Streaming Platform

A modern music streaming platform built with React, Node.js, MongoDB, and Amazon S3, integrated with Spotify Web API.

## 🏗️ Architecture Overview

### Data Flow (Database-First Approach)

1. **Browse Music**: Songs are fetched from MongoDB database first
2. **Search**: Database search first, then Spotify API for additional results
3. **Play Track**: When user plays a song:
   - Check if song exists in MongoDB
   - If exists: Generate S3 signed URL and play
   - If not exists: Check S3 for audio file
   - Get metadata from Spotify API
   - Store in MongoDB with S3 audio URL
   - Stream audio from Amazon S3

### Technology Stack

#### Frontend

- **React 18** with Vite
- **Howler.js** for audio playback
- **Lucide React** for icons
- **Axios** for API calls

#### Backend

- **Node.js** with Express
- **MongoDB** with Mongoose
- **Redis** for caching and optimization
- **Amazon S3** for audio file storage
- **Spotify Web API** for music metadata
- **JWT** authentication with refresh tokens

#### External Services

- **Spotify Web API** - Music metadata and search
- **Amazon S3** - Audio file storage (bucket: listeners101)
- **MongoDB Atlas** - Database hosting (optional)
- **Redis Cloud** - Cache hosting (optional)

## 🚀 Quick Start

### Prerequisites

- Node.js (v16 or higher)
- MongoDB
- Redis
- Amazon S3 bucket (listeners101)
- Spotify Developer Account

### 1. Clone and Install

```bash
git clone <repository-url>
cd listeners

# Install frontend dependencies
npm install

# Install backend dependencies
cd backend
npm install
```

### 2. Environment Setup

Copy `.env.example` to `.env` in the backend directory and configure:

```bash
cd backend
cp .env.example .env
```

Required environment variables:

- `MONGODB_URI` - MongoDB connection string
- `REDIS_URL` - Redis connection string
- `SPOTIFY_CLIENT_ID` - Spotify app client ID
- `SPOTIFY_CLIENT_SECRET` - Spotify app client secret
- `AWS_ACCESS_KEY_ID` - AWS access key
- `AWS_SECRET_ACCESS_KEY` - AWS secret key
- `AWS_S3_BUCKET_NAME` - S3 bucket name (listeners101)
- `AWS_REGION` - AWS region

### 3. Amazon S3 Setup

1. Create an S3 bucket named `listeners101`
2. Configure bucket permissions for public read access
3. Upload audio files with naming convention: `{spotify-track-id}.mp3`

### 4. Spotify API Setup

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Copy Client ID and Client Secret to `.env`

### 5. Audio Files Setup

Upload your audio files to S3 with naming convention:

```
{spotify-track-id}.mp3
```

### 6. Run the Application

```bash
# Start backend (from backend directory)
npm run dev

# Start frontend (from root directory)
npm run dev
```

- Frontend: http://localhost:12000
- Backend: http://localhost:3001

## 📁 Project Structure

```
listeners/
├── src/                          # Frontend React app
│   ├── components/              # React components
│   ├── contexts/               # React contexts
│   ├── services/               # API services
│   └── hooks/                  # Custom hooks
├── backend/                     # Backend Node.js app
│   ├── config/                 # Configuration files
│   │   ├── database.js         # MongoDB & Redis config
│   │   └── s3.js              # Amazon S3 service
│   ├── models/                 # MongoDB models
│   ├── routes/                 # API routes
│   ├── services/               # Business logic
│   ├── middleware/             # Express middleware
│   └── server.js              # Main server file
└── README.md
```

## 🎵 Features

### Current Features

- **Database-First Architecture** - Songs loaded from MongoDB first
- **Smart Search** - Database search first, then Spotify fallback
- **Audio Streaming** - Stream from Amazon S3 with signed URLs
- **Redis Caching** - Optimized performance with Redis
- **User Authentication** - JWT with refresh tokens
- **Play History** - Track user listening history
- **Responsive Design** - Works on all devices

### Planned Features

- **Playlists** - Create and manage playlists
- **Social Features** - Follow users, share music
- **Offline Mode** - Download for offline listening
- **Music Recommendations** - AI-powered suggestions

## 🔧 API Endpoints

### Music Routes

- `GET /api/music/database/songs` - Get all songs from database
- `GET /api/music/search` - Search songs (database first, then Spotify)
- `GET /api/music/database/trending` - Get trending songs from database
- `POST /api/music/:spotifyId/play` - Play song (database-first approach)
- `GET /api/music/:spotifyId` - Get song details
- `POST /api/music/:spotifyId/like` - Like/unlike song

### Authentication Routes

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh-token` - Refresh JWT token
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

## 🛠️ Development

### Backend Development

```bash
cd backend
npm run dev  # Starts with nodemon
```

### Frontend Development

```bash
npm run dev  # Starts Vite dev server
```

### Database Seeding

The application automatically creates songs in the database when they are played for the first time.

## 🔒 Security Features

- **JWT Authentication** with refresh tokens
- **Rate Limiting** on API endpoints
- **CORS Protection** with whitelist
- **Helmet.js** for security headers
- **Input Validation** with express-validator
- **Password Hashing** with bcrypt
- **MFA Support** with TOTP

## ⚡ Performance Optimizations

- **Redis Caching** for frequently accessed data
- **Database Indexing** for fast queries
- **S3 Signed URLs** for secure audio streaming
- **Lazy Loading** for large song lists
- **Search Result Caching** for improved search performance

## 📱 Responsive Design

The application is fully responsive and works on:

- Desktop (1920px+)
- Laptop (1024px+)
- Tablet (768px+)
- Mobile (320px+)

## 🚀 Deployment

### Backend Deployment

1. Set up MongoDB Atlas
2. Set up Redis Cloud
3. Configure Amazon S3
4. Deploy to Heroku/Railway/DigitalOcean
5. Set environment variables

### Frontend Deployment

1. Build the app: `npm run build`
2. Deploy to Netlify/Vercel/Cloudflare Pages
3. Set `VITE_API_URL` environment variable

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support, please open an issue on GitHub or contact the development team.

---

**Built with ❤️ by the Listeners Team**
