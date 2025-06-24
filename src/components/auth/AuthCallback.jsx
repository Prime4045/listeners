import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.jsx';

const AuthCallback = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth();

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const token = params.get('token');
        const refreshToken = params.get('refreshToken');
        const error = params.get('error');
        const message = params.get('message');

        if (error) {
            console.error('OAuth error:', message);
            navigate('/login', { state: { error: message || 'Authentication failed' } });
            return;
        }

        if (token && refreshToken) {
            // Store tokens and fetch user
            login({ token, refreshToken })
                .then(() => navigate('/dashboard'))
                .catch((err) => {
                    console.error('Callback login error:', err);
                    navigate('/login', { state: { error: 'Failed to authenticate. Please try again.' } });
                });
        } else {
            navigate('/login', { state: { error: 'Invalid authentication response' } });
        }
    }, [location, navigate, login]);

    return (
        <div className="loading-screen">
            <div className="loading-content">
                <Loader2 className="animate-spin" size={24} />
                <p>Authenticating...</p>
            </div>
        </div>
    );
};

export default AuthCallback;