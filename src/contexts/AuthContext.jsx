import { createContext, useContext, useState, useEffect } from 'react';
import ApiService from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  const login = async () => {
    try {
      const userData = await ApiService.getCurrentUser();
      setUser(userData);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Auth login error:', error);
      setUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem('token');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      await ApiService.logout(refreshToken);
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      login();
    } else {
      setLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);