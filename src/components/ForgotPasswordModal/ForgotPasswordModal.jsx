import React, { useState } from 'react';
import { X, Mail, Loader2, AlertCircle, Check, ArrowLeft } from 'lucide-react';
import ApiService from '../../services/api';
import './ForgotPasswordModal.css';

const ForgotPasswordModal = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await ApiService.forgotPassword(email.trim());
      setSuccess(true);
    } catch (err) {
      console.error('Forgot password error:', err);
      setError(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setError(null);
    setSuccess(false);
    setLoading(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="forgot-password-modal">
        <div className="modal-header">
          <h2>Reset Password</h2>
          <button className="close-btn" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-content">
          {success ? (
            <div className="success-state">
              <div className="success-icon">
                <Check size={48} />
              </div>
              <h3>Check your email</h3>
              <p>
                We've sent a password reset link to <strong>{email}</strong>
              </p>
              <p className="help-text">
                Didn't receive the email? Check your spam folder or try again.
              </p>
              <button className="back-btn" onClick={handleClose}>
                <ArrowLeft size={16} />
                Back to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="forgot-form">
              <div className="form-description">
                <p>Enter your email address and we'll send you a link to reset your password.</p>
              </div>

              {error && (
                <div className="error-message">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <div className="input-wrapper">
                  <Mail className="input-icon" size={18} />
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    className={error ? 'error' : ''}
                    disabled={loading}
                    autoFocus
                  />
                </div>
              </div>

              <button type="submit" className="submit-btn" disabled={loading || !email.trim()}>
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Sending...
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </button>

              <button type="button" className="cancel-btn" onClick={handleClose}>
                Cancel
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordModal;