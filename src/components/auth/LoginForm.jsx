import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, Shield, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import './AuthForms.css';

const LoginForm = ({ onSwitchToRegister, onClose }) => {
  const [formData, setFormData] = useState({
    emailOrUsername: '',
    password: '',
    rememberMe: false,
    mfaCode: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [requiresMFA, setRequiresMFA] = useState(false);
  const { login } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const error = params.get('error');
    const message = params.get('message');
    if (error === 'oauth_failed' && message) {
      setErrors({ general: decodeURIComponent(message) });
    }
  }, [location]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.emailOrUsername.trim()) {
      newErrors.emailOrUsername = 'Email or username is required';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    if (requiresMFA && !formData.mfaCode) {
      newErrors.mfaCode = 'MFA code is required';
    } else if (requiresMFA && formData.mfaCode.length !== 6) {
      newErrors.mfaCode = 'MFA code must be 6 digits';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});

    try {
      const response = await login(formData);

      if (response.requiresMFA) {
        setRequiresMFA(true);
        setErrors({ general: 'Please enter your MFA code to continue' });
      } else {
        onClose?.();
      }
    } catch (error) {
      console.error('Login error:', error);

      if (error.code === 'ACCOUNT_LOCKED') {
        setErrors({
          general: `Account is temporarily locked. Try again after ${new Date(error.lockUntil).toLocaleString()}`,
        });
      } else if (error.code === 'INVALID_CREDENTIALS') {
        setErrors({ general: 'Invalid email/username or password' });
      } else if (error.code === 'INVALID_MFA_CODE') {
        setErrors({ mfaCode: 'Invalid MFA code' });
      } else {
        setErrors({ general: error.message || 'Login failed. Please try again.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    const apiUrl = import.meta.env.VITE_API_URL || 'https://work-2-kdvllvgyfifstacd.prod-runtime.all-hands.dev/api';
    window.location.href = `${apiUrl}/auth/google`;
  };

  return (
    <div className="auth-form">
      <div className="auth-header">
        <h2>Welcome Back</h2>
        <p>Sign in to your Listeners account</p>
      </div>

      {errors.general && (
        <div className="error-message">
          <AlertCircle size={16} />
          <span>{errors.general}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="auth-form-content">
        <div className="form-group">
          <label htmlFor="emailOrUsername">Email or Username</label>
          <div className="input-wrapper">
            <User className="input-icon" size={18} />
            <input
              type="text"
              id="emailOrUsername"
              name="emailOrUsername"
              value={formData.emailOrUsername}
              onChange={handleChange}
              placeholder="Enter your email or username"
              className={errors.emailOrUsername ? 'error' : ''}
              autoComplete="username"
              disabled={isLoading}
            />
          </div>
          {errors.emailOrUsername && (
            <span className="error-text">{errors.emailOrUsername}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <div className="input-wrapper">
            <Lock className="input-icon" size={18} />
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your password"
              className={errors.password ? 'error' : ''}
              autoComplete="current-password"
              disabled={isLoading}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
              disabled={isLoading}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.password && (
            <span className="error-text">{errors.password}</span>
          )}
        </div>

        {requiresMFA && (
          <div className="form-group">
            <label htmlFor="mfaCode">MFA Code</label>
            <div className="input-wrapper">
              <Shield className="input-icon" size={18} />
              <input
                type="text"
                id="mfaCode"
                name="mfaCode"
                value={formData.mfaCode}
                onChange={handleChange}
                placeholder="Enter 6-digit MFA code"
                className={errors.mfaCode ? 'error' : ''}
                maxLength="6"
                disabled={isLoading}
              />
            </div>
            {errors.mfaCode && (
              <span className="error-text">{errors.mfaCode}</span>
            )}
          </div>
        )}

        <div className="form-options">
          <label className="checkbox-label">
            <input
              type="checkbox"
              name="rememberMe"
              checked={formData.rememberMe}
              onChange={handleChange}
              disabled={isLoading}
            />
            <span className="checkbox-custom"></span>
            Remember me for 30 days
          </label>

          <button
            type="button"
            className="link-button"
            onClick={() => {/* TODO: Implement forgot password */ }}
            disabled={isLoading}
          >
            Forgot password?
          </button>
        </div>

        <button
          type="submit"
          className="auth-submit-btn"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" size={18} />
              Signing in...
            </>
          ) : (
            'Sign In'
          )}
        </button>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <button
          type="button"
          className="google-auth-btn"
          onClick={handleGoogleLogin}
          disabled={isLoading}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </button>
      </form>

      <div className="auth-footer">
        <p>
          Don't have an account?{' '}
          <button
            type="button"
            className="link-button"
            onClick={onSwitchToRegister}
            disabled={isLoading}
          >
            Sign up
          </button>
        </p>
      </div>
    </div>
  );
};

export default LoginForm;