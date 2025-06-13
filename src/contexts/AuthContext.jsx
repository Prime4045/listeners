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
      // Validate token with backend
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
      setUser(response);
      setIsAuthenticated(true);
      localStorage.setItem('token', token);
    } catch (error) {
      console.error('Token validation failed:', error);
      localStorage.removeItem('token');
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  // Login function
  const login = async (email, password) => {
    try {
      const response = await ApiService.request('POST', '/auth/login', {
        email,
        password,
      });
      const { token, user } = response;
      setUser(user);
      setIsAuthenticated(true);
      localStorage.setItem('token', token);
      return user;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setIsAuthenticated(false);
  };

  // Register function
  const register = async (username, email, password) => {
    try {
      const response = await ApiService.request('POST', '/auth/register', {
        username,
        email,
        password,
      });
      const { token, user } = response;
      setUser(user);
      setIsAuthenticated(true);
      localStorage.setItem('token', token);
      return user;
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  };

  const value = {
    user,
    isAuthenticated,
    loading,
    login,
    logout,
    register,
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
