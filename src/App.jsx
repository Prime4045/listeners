import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { MusicProvider } from './contexts/MusicContext';
import { NotificationProvider } from './contexts/NotificationContext';
import ErrorBoundary from './components/ErrorBoundary';
import Header from './components/Header/Header';
import Sidebar from './components/Sidebar/Sidebar';
import Home from './pages/Home/Home';
import Search from './pages/Search/Search';
import Library from './pages/Library/Library';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import ResetPassword from './pages/ResetPassword';
import Profile from './components/Profile/Profile';
import Dashboard from './components/Dashboard/Dashboard';
import PlaylistView from './components/PlaylistView/PlaylistView';
import AuthCallback from './components/AuthCallback';
import MusicPlayer from './components/MusicPlayer/MusicPlayer';
import LoadingScreen from './components/LoadingScreen/LoadingScreen';
import './App.css';

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isPlayerMinimized, setIsPlayerMinimized] = useState(false);

  useEffect(() => {
    // Simulate app initialization
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <ErrorBoundary>
      <AuthProvider>
        <NotificationProvider>
          <MusicProvider>
            <Router>
              <div className="app">
                <Routes>
                  {/* Auth Routes */}
                  <Route path="/signin" element={<SignIn />} />
                  <Route path="/signup" element={<SignUp />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/auth/callback" element={<AuthCallback />} />

                  {/* Main App Routes */}
                  <Route path="/*" element={
                    <div className="app-layout">
                      <Header />
                      <div className="main-layout">
                        <Sidebar />
                        <main className="main-content">
                          <Routes>
                            <Route path="/" element={<Home />} />
                            <Route path="/search" element={<Search />} />
                            <Route path="/library" element={<Library />} />
                            <Route path="/profile" element={<Profile />} />
                            <Route path="/dashboard" element={<Dashboard />} />
                            <Route path="/playlist/:id" element={<PlaylistView />} />
                            <Route path="*" element={<Navigate to="/" replace />} />
                          </Routes>
                        </main>
                      </div>
                      <MusicPlayer
                        isMinimized={isPlayerMinimized}
                        onToggleMinimize={() => setIsPlayerMinimized(!isPlayerMinimized)}
                      />
                    </div>
                  } />
                </Routes>
              </div>
            </Router>
          </MusicProvider>
        </NotificationProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;