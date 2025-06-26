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
    if (error === 'Oauth_failed' && message) {
      setErrors({ general: decodeURIComponent(message) });
    } else if (error) {
      setErrors({ general: 'Authentication failed. Please try again.' });
    }
  }, [location]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
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
        setErrors({ message: 'Please enter your MFA code to continue' });
      } else {
        onClose();
      }
    } catch (error) {
      console.error('Login error:', error);

      if (error.code === 'ACCOUNT_LOCKED') {
        setErrors({
          general: `Account is temporarily locked until ${new Date(error.lockUntil).toLocaleString()}`,
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
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const redirect = encodeURIComponent('/dashboard');
    window.location.href = `${apiUrl}/api/auth/google?redirect=${redirect}`;
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
          <label htmlFor="emailOrUsername">Email or Username *</label>
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
          <label htmlFor="password">Password *</label>
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
            onClick={() => {
              /* TODO: Implement forgot password */
            }}
            disabled={isLoading}
          >
            Forgot password?
          </button>
        </div>

        <button type="submit" className="auth-submit-btn" disabled={isLoading}>
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
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path
              fill="#4285F4"
              d="M17.64 9.2c0-.63-.06-1.23-.16-1.8H9v3.41h4.84c-.21 1.1-.83 2.03-1.77 2.65v2.2h2.86c1.67-1.54 2.67-3.8 2.67-6.46z"
            />
            <path
              fill="#34A853"
              d="M9 18c2.43 0 4.47-.8 5.96-2.17l-2.86-2.2c-.8.54-1.83.86-3.1.86-2.37 0-4.39-1.6-5.11-3.77H.96v2.34C2.43 16.2 5.37 18 9 18z"
            />
            <path
              fill="#FBBC05"
              d="M3.89 10.8c-.3-.55-.44-1.14-.45-1.85v-.01c.01-.7.15-1.3.45-1.85l-.05-.02H.96C.35 6.2 0 7.57 0 9s.35 2.8.96 4.14l2.93-2.34z"
            />
            <path
              fill="#EA4335"
              d="M9 3.6c1.3 0 2.47.45 3.39 1.33l2.54-2.54C13.47.95 11.43 0 9 0 5.37 0 2.43 1.8.96 4.86l2.93 2.34C4.61 5.4 6.63 3.6 9 3.6z"
            />
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