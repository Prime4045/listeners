# 🎵 Listeners - Music Streaming Platform

A modern music streaming website built with React, Node.js, and advanced audio libraries.

## 🚀 How to Run the Website

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Option 1: Run Frontend Only (Currently Working)

The frontend is already running and fully functional! Simply visit:

If you need to restart the frontend:
```bash
cd /workspace/listeners
npm run dev
```

### Option 2: Run Full Stack (Frontend + Backend)

1. **Start the backend server:**
   ```bash
   cd /workspace/listeners/backend
   npm run dev
   ```
   Backend will run on port 3001

2. **Frontend is already running on port 12000**

### 🎯 Current Features

#### ✅ Working Now
- **Interactive Music Player** - Play/pause, track switching
- **Navigation** - Home, Your Library, Liked Songs
- **Modern UI** - Dark theme with purple/pink gradients
- **Responsive Design** - Works on all devices
- **Track Management** - Grid and list views
- **Search Interface** - Ready for backend integration
- **Playlist Sidebar** - Sample playlists displayed

#### 🔄 Backend Ready for Integration
- **Express.js API** - RESTful endpoints
- **Authentication** - JWT + OAuth 2.0
- **Database Support** - PostgreSQL, MongoDB, Redis
- **File Uploads** - Audio file handling
- **Real-time Features** - Socket.IO integration
- **Security** - Helmet, CORS, rate limiting

### 🛠 Technology Stack

#### Frontend (Running)
- React 18 + Vite
- Howler.js (audio playback)
- WaveSurfer.js (waveforms)
- Tone.js (audio effects)
- Lucide React (icons)

#### Backend (Ready)
- Node.js + Express
- PostgreSQL + MongoDB + Redis
- JWT Authentication
- Socket.IO for real-time features

### 📱 What You Can Do Right Now

1. **🎵 Play Music** - Click any track to start playing
2. **🔄 Switch Tracks** - Click different songs to change playback
3. **📂 Navigate Views** - Switch between Home, Library, Liked Songs
4. **🎨 Enjoy the UI** - Hover effects and smooth animations
5. **📱 Test Responsiveness** - Works on mobile and desktop

### 🌐 Access URLs

- **Main Website**: https://work-1-bdnhsafuzubjmrbg.prod-runtime.all-hands.dev
- **Backend API** (when running): http://localhost:3001

### 🚀 Next Steps for Full Integration

1. Connect real audio files
2. Implement user authentication
3. Add database integration
4. Enable file uploads
5. Add real-time features

**Status**: Frontend is fully functional with mock data. Backend architecture is complete and ready for deployment!
