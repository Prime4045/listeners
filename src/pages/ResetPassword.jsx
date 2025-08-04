import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Lock, Loader2, AlertCircle, Check, ArrowLeft, Music } from 'lucide-react';
import ApiService from '../services/api';
import './AuthPages.css';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [token, setToken] = useState('');

  useEffect(() => {
    const resetToken = searchParams.get('token');
    if (!resetToken) {
      navigate('/signin');
      return;
    }
    setToken(resetToken);
  }, [searchParams, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.newPassword) {
      newErrors.newPassword = 'New password is required';
    } else if (formData.newPassword.length < 8) {
      newErrors.newPassword = 'Password must be at least 8 characters';
    } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(formData.newPassword)) {
      newErrors.newPassword = 'Password must contain uppercase, lowercase, number, and special character';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
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
      await ApiService.resetPassword(token, formData.newPassword, formData.confirmPassword);
      setSuccess(true);
    } catch (error) {
      console.error('Reset password error:', error);
      if (error.code === 'INVALID_RESET_TOKEN') {
        setErrors({ general: 'Invalid or expired reset link. Please request a new one.' });
      } else {
        setErrors({ general: error.message || 'Failed to reset password. Please try again.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-branding">
            <div className="branding-content">
              <div className="logo-large">
                <div className="logo-icon-large">
                  <Check size={48} />
                </div>
                <h1 className="logo-text-large">Success!</h1>
              </div>
              <h2 className="branding-title">Password Reset Complete</h2>
              <p className="branding-subtitle">
                Your password has been successfully reset. You can now sign in with your new password.
              </p>
            </div>
          </div>

          <div className="auth-form-section">
            <div className="auth-form-container">
              <div className="auth-header">
                <h2>Password Reset Successful</h2>
                <p>You can now sign in with your new password</p>
              </div>

              <button
                className="auth-submit-btn"
                onClick={() => navigate('/signin')}
              >
                <ArrowLeft size={18} />
                Back to Sign In
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <button 
        className="auth-back-btn"
        onClick={() => navigate('/signin')}
        title="Back to sign in"
      >
        <ArrowLeft size={20} />
      </button>
      
      <div className="auth-container">
        <div className="auth-branding">
          <div className="branding-content">
            <div className="logo-large">
              <div className="logo-icon-large">
                <Music size={48} />
              </div>
              <h1 className="logo-text-large">Listeners</h1>
            </div>
            <h2 className="branding-title">Reset Your Password</h2>
            <p className="branding-subtitle">
              Enter your new password below to regain access to your account.
            </p>
          </div>
        </div>

        <div className="auth-form-section">
          <div className="auth-form-container">
            <div className="auth-header">
              <h2>Set New Password</h2>
              <p>Choose a strong password for your account</p>
            </div>

            {errors.general && (
              <div className="error-message">
                <AlertCircle size={16} />
                <span>{errors.general}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label htmlFor="newPassword">New Password</label>
                <div className="input-wrapper">
                  <Lock className="input-icon" size={18} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="newPassword"
                    name="newPassword"
                    value={formData.newPassword}
                    onChange={handleChange}
                    placeholder="Enter your new password"
                    className={errors.newPassword ? 'error' : ''}
                    autoComplete="new-password"
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
                {errors.newPassword && (
                  <span className="error-text">{errors.newPassword}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm New Password</label>
                <div className="input-wrapper">
                  <Lock className="input-icon" size={18} />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Confirm your new password"
                    className={errors.confirmPassword ? 'error' : ''}
                    autoComplete="new-password"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={isLoading}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <span className="error-text">{errors.confirmPassword}</span>
                )}
              </div>

              <button type="submit" className="auth-submit-btn" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Resetting Password...
                  </>
                ) : (
                  'Reset Password'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;