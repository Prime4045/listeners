import { createContext, useContext, useState, useEffect } from 'react';
import ApiService from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  const login = async (loginData) => {
    try {
      // Validate required fields before making request
      if (!loginData.emailOrUsername || !loginData.password) {
        throw {
          message: 'Email/username and password are required',
          code: 'VALIDATION_ERROR',
          errors: [
            { param: 'emailOrUsername', msg: 'Email or username is required' },
            { param: 'password', msg: 'Password is required' }
          ]
        };
      }

      const response = await ApiService.login(loginData);
      
      if (response.requiresMFA) {
        return response; // Return MFA requirement
      }

      // Store tokens
      localStorage.setItem('token', response.token);
      localStorage.setItem('refreshToken', response.refreshToken);

      // Set user data
      setUser(response.user);
      setIsAuthenticated(true);

      return response;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const register = async (registerData) => {
    try {
      const response = await ApiService.register(registerData);

      // Store tokens
      localStorage.setItem('token', response.token);
      localStorage.setItem('refreshToken', response.refreshToken);

      // Set user data
      setUser(response.user);
      setIsAuthenticated(true);

      return response;
    } catch (error) {
      console.error('Register error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      await ApiService.logout(refreshToken);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local storage and state regardless of API call success
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const updateUser = (userData) => {
    setUser(userData);
  };

  const checkAuth = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await ApiService.getCurrentUser();
      setUser(response.user);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Auth check error:', error);
      // Clear invalid tokens
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const value = {
    user,
    isAuthenticated,
    loading,
    login,
    register,
    logout,
    updateUser,
    checkAuth,
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