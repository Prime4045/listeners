import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  Phone,
  Upload,
  Check,
  X,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import './AuthForms.css';

const RegisterForm = ({ onSwitchToLogin, onClose }) => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phoneNumber: '',
    profilePicture: null,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    feedback: [],
  });
  const [profilePreview, setProfilePreview] = useState(null);
  const { register } = useAuth();

  const handleChange = (e) => {
    const { name, value, type, files } = e.target;

    if (type === 'file') {
      const file = files[0];
      if (file) {
        if (file.size > 5 * 1024 * 1024) {
          setErrors((prev) => ({ ...prev, profilePicture: 'File size must be less than 5MB' }));
          return;
        }

        if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
          setErrors((prev) => ({
            ...prev,
            profilePicture: 'Only JPG, JPEG, and PNG files are allowed',
          }));
          return;
        }

        setFormData((prev) => ({ ...prev, [name]: file }));

        const reader = new FileReader();
        reader.onload = (e) => setProfilePreview(e.target.result);
        reader.readAsDataURL(file);
      }
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }

    if (name === 'password') {
      checkPasswordStrength(value);
    }
  };

  const checkPasswordStrength = (password) => {
    const checks = [
      { test: /.{8,}/, message: 'At least 8 characters' },
      { test: /[a-z]/, message: 'One lowercase letter' },
      { test: /[A-Z]/, message: 'One uppercase letter' },
      { test: /\d/, message: 'One number' },
      { test: /[@$!%*?&]/, message: 'One special character' },
    ];

    const passed = checks.filter((check) => check.test.test(password));
    const feedback = checks.map((check) => ({
      ...check,
      passed: check.test.test(password),
    }));

    setPasswordStrength({
      score: passed.length,
      feedback,
    });
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3 || formData.username.length > 20) {
      newErrors.username = 'Username must be 3-20 characters';
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      newErrors.username = 'Username can only contain letters, numbers, and underscores';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (passwordStrength.score < 5) {
      newErrors.password = 'Password does not meet security requirements';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (formData.firstName && (formData.firstName.length < 2 || formData.firstName.length > 30)) {
      newErrors.firstName = 'First name must be 2-30 characters';
    }

    if (formData.lastName && (formData.lastName.length < 2 || formData.lastName.length > 30)) {
      newErrors.lastName = 'Last name must be 2-30 characters';
    }

    if (formData.phoneNumber && !/^\+[1-9]\d{1,14}$/.test(formData.phoneNumber)) {
      newErrors.phoneNumber = 'Phone number must be in international format (+1234567890)';
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
      const formDataToSend = new FormData();
      Object.keys(formData).forEach((key) => {
        if (formData[key] !== null && formData[key] !== '') {
          formDataToSend.append(key, formData[key]);
        }
      });

      await register(formDataToSend);
      onClose();
    } catch (error) {
      console.error('Registration error:', error);

      if (error.code === 'DUPLICATE_ENTRY') {
        setErrors({
          [error.field]: error.message,
        });
      } else if (error.code === 'VALIDATION_ERROR' && error.errors) {
        const validationErrors = {};
        error.errors.forEach((err) => {
          validationErrors[err.path || err.param] = err.msg || err.message;
        });
        setErrors(validationErrors);
      } else {
        setErrors({ general: error.message || 'Registration failed. Please try again.' });
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

  const getPasswordStrengthColor = () => {
    if (passwordStrength.score <= 2) return '#ef4444';
    if (passwordStrength.score <= 3) return '#f59e0b';
    if (passwordStrength.score <= 4) return '#eab308';
    return '#10b981';
  };

  const getPasswordStrengthText = () => {
    if (passwordStrength.score <= 2) return 'Weak';
    if (passwordStrength.score <= 3) return 'Fair';
    if (passwordStrength.score <= 4) return 'Good';
    return 'Strong';
  };

  return (
    <div className="auth-form">
      <div className="auth-header">
        <h2>Create Account</h2>
        <p>Join Listeners and discover amazing music</p>
      </div>

      {errors.general && (
        <div className="error-message">
          <AlertCircle size={16} />
          <span>{errors.general}</span>
        </div>
      )}

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
        Sign up with Google
      </button>

      <div className="auth-divider">
        <span>or</span>
      </div>

      <form onSubmit={handleSubmit} className="auth-form-content">
        <div className="form-group">
          <label>Profile Picture (Optional)</label>
          <div className="profile-upload">
            <div className="profile-preview">
              {profilePreview ? (
                <img src={profilePreview} alt="Profile preview" />
              ) : (
                <User size={32} />
              )}
            </div>
            <div className="upload-controls">
              <input
                type="file"
                id="profilePicture"
                name="profilePicture"
                accept="image/jpeg,image/jpg,image/png"
                onChange={handleChange}
                className="file-input"
                disabled={isLoading}
              />
              <label htmlFor="profilePicture" className="upload-btn">
                <Upload size={16} />
                Choose Photo
              </label>
              <span className="upload-hint">Max 5MB, JPG/PNG only</span>
            </div>
          </div>
          {errors.profilePicture && (
            <span className="error-text">{errors.profilePicture}</span>
          )}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="firstName">First Name (Optional)</label>
            <div className="input-wrapper">
              <User className="input-icon" size={18} />
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="Enter your first name"
                className={errors.firstName ? 'error' : ''}
                autoComplete="given-name"
                disabled={isLoading}
              />
            </div>
            {errors.firstName && (
              <span className="error-text">{errors.firstName}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="lastName">Last Name (Optional)</label>
            <div className="input-wrapper">
              <User className="input-icon" size={18} />
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Enter your last name"
                className={errors.lastName ? 'error' : ''}
                autoComplete="family-name"
                disabled={isLoading}
              />
            </div>
            {errors.lastName && (
              <span className="error-text">{errors.lastName}</span>
            )}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="username">Username *</label>
          <div className="input-wrapper">
            <User className="input-icon" size={18} />
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="Choose a unique username"
              className={errors.username ? 'error' : ''}
              autoComplete="username"
              disabled={isLoading}
            />
          </div>
          {errors.username && (
            <span className="error-text">{errors.username}</span>
          )}
          <span className="field-hint">3-20 characters, letters, numbers, and underscores only</span>
        </div>

        <div className="form-group">
          <label htmlFor="email">Email Address *</label>
          <div className="input-wrapper">
            <Mail className="input-icon" size={17} />
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email address"
              className={errors.email ? 'error' : ''}
              autoComplete="email"
              disabled={isLoading}
            />
          </div>
          {errors.email && (
            <span className="error-text">{errors.email}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="phoneNumber">Phone Number (Optional)</label>
          <div className="input-wrapper">
            <Phone className="input-icon" size={18} />
            <input
              type="tel"
              id="phoneNumber"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleChange}
              placeholder="+1234567890"
              className={errors.phoneNumber ? 'error' : ''}
              autoComplete="tel"
              disabled={isLoading}
            />
          </div>
          {errors.phoneNumber && (
            <span className="error-text">{errors.phoneNumber}</span>
          )}
          <span className="field-hint">Include country code (e.g., +1 for US)</span>
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
              placeholder="Create a strong password"
              className={errors.password ? 'error' : ''}
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
          {errors.password && (
            <span className="error-text">{errors.password}</span>
          )}

          {formData.password && (
            <div className="password-strength">
              <div className="strength-bar">
                <div
                  className="strength-fill"
                  style={{
                    width: `${(passwordStrength.score / 5) * 100}%`,
                    backgroundColor: getPasswordStrengthColor(),
                  }}
                />
              </div>
              <span
                className="strength-text"
                style={{ color: getPasswordStrengthColor() }}
              >
                {getPasswordStrengthText()}
              </span>
              <div className="strength-requirements">
                {passwordStrength.feedback.map((req, index) => (
                  <div key={index} className={`requirement ${req.passed ? 'passed' : 'failed'}`}>
                    {req.passed ? <Check size={12} /> : <X size={12} />}
                    <span>{req.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="confirmPassword">Confirm Password *</label>
          <div className="input-wrapper">
            <Lock className="input-icon" size={17} />
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Confirm your password"
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
          {formData.confirmPassword && formData.password === formData.confirmPassword && (
            <div className="success-message">
              <Check size={16} />
              <span>Passwords match</span>
            </div>
          )}
        </div>

        <button
          type="submit"
          className="auth-submit-btn"
          disabled={isLoading || passwordStrength.score < 5}
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" size={18} />
              Creating Account...
            </>
          ) : (
            'Create Account'
          )}
        </button>
      </form>

      <div className="auth-footer">
        <p>
          Already have an account?{' '}
          <button
            type="button"
            className="link-button"
            onClick={onSwitchToLogin}
            disabled={isLoading}
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
};

export default RegisterForm;