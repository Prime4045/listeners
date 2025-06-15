import React, { createContext, useState, useEffect, useContext } from 'react';
import ApiService from '../services/api.js';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check for existing token on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      validateToken(token);
    } else {
      setLoading(false);
    }
  }, []);

  // Validate JWT token
  const validateToken = async (token) => {
    try {
      const response = await ApiService.request('GET', '/auth/me', null, {
        Authorization: `Bearer ${token}`,
      });
      setUser(response.user);
      setIsAuthenticated(true);
      localStorage.setItem('token', token);
    } catch (error) {
      console.error('Token validation failed:', error);
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  // Login function
  const login = async (credentials) => {
    try {
      const response = await ApiService.request('POST', '/auth/login', credentials);
      
      if (response.requiresMFA) {
        return response; // Return MFA requirement
      }
      
      const { token, refreshToken, user } = response;
      setUser(user);
      setIsAuthenticated(true);
      localStorage.setItem('token', token);
      localStorage.setItem('refreshToken', refreshToken);
      return user;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  // Register function
  const register = async (userData) => {
    try {
      let response;
      
      if (userData instanceof FormData) {
        // Handle FormData for file uploads
        response = await ApiService.axiosInstance.post('/auth/register', userData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        response = response.data;
      } else {
        response = await ApiService.request('POST', '/auth/register', userData);
      }
      
      const { token, refreshToken, user } = response;
      setUser(user);
      setIsAuthenticated(true);
      localStorage.setItem('token', token);
      localStorage.setItem('refreshToken', refreshToken);
      return user;
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  };

  // Logout function
  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      await ApiService.request('POST', '/auth/logout', { refreshToken });
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  // Refresh token function
  const refreshToken = async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await ApiService.request('POST', '/auth/refresh-token', {
        refreshToken,
      });

      const { token: newToken, refreshToken: newRefreshToken } = response;
      localStorage.setItem('token', newToken);
      localStorage.setItem('refreshToken', newRefreshToken);
      
      return newToken;
    } catch (error) {
      console.error('Token refresh failed:', error);
      logout();
      throw error;
    }
  };

  // Update user profile
  const updateProfile = async (updates) => {
    try {
      const response = await ApiService.request('PUT', '/users/profile', updates);
      setUser(response);
      return response;
    } catch (error) {
      console.error('Profile update failed:', error);
      throw error;
    }
  };

  // Change password
  const changePassword = async (currentPassword, newPassword) => {
    try {
      await ApiService.request('POST', '/auth/change-password', {
        currentPassword,
        newPassword,
      });
    } catch (error) {
      console.error('Password change failed:', error);
      throw error;
    }
  };

  // Setup MFA
  const setupMFA = async () => {
    try {
      const response = await ApiService.request('POST', '/auth/setup-mfa');
      return response;
    } catch (error) {
      console.error('MFA setup failed:', error);
      throw error;
    }
  };

  // Verify MFA
  const verifyMFA = async (code) => {
    try {
      await ApiService.request('POST', '/auth/verify-mfa', { code });
      // Refresh user data to get updated MFA status
      const updatedUser = await ApiService.request('GET', '/auth/me');
      setUser(updatedUser.user);
    } catch (error) {
      console.error('MFA verification failed:', error);
      throw error;
    }
  };

  // Disable MFA
  const disableMFA = async (password, code) => {
    try {
      await ApiService.request('POST', '/auth/disable-mfa', { password, code });
      // Refresh user data to get updated MFA status
      const updatedUser = await ApiService.request('GET', '/auth/me');
      setUser(updatedUser.user);
    } catch (error) {
      console.error('MFA disable failed:', error);
      throw error;
    }
  };

  // Request password reset
  const requestPasswordReset = async (email) => {
    try {
      await ApiService.request('POST', '/auth/forgot-password', { email });
    } catch (error) {
      console.error('Password reset request failed:', error);
      throw error;
    }
  };

  // Reset password
  const resetPassword = async (token, password, confirmPassword) => {
    try {
      await ApiService.request('POST', '/auth/reset-password', {
        token,
        password,
        confirmPassword,
      });
    } catch (error) {
      console.error('Password reset failed:', error);
      throw error;
    }
  };

  // Verify email
  const verifyEmail = async (token) => {
    try {
      await ApiService.request('GET', `/auth/verify-email?token=${token}`);
      // Refresh user data to get updated verification status
      const updatedUser = await ApiService.request('GET', '/auth/me');
      setUser(updatedUser.user);
    } catch (error) {
      console.error('Email verification failed:', error);
      throw error;
    }
  };

  const value = {
    user,
    isAuthenticated,
    loading,
    login,
    register,
    logout,
    refreshToken,
    updateProfile,
    changePassword,
    setupMFA,
    verifyMFA,
    disableMFA,
    requestPasswordReset,
    resetPassword,
    verifyEmail,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};