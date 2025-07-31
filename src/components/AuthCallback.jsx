import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

const AuthCallback = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { updateUser } = useAuth();

    useEffect(() => {
        const handleCallback = async () => {
            const token = searchParams.get('token');
            const refreshToken = searchParams.get('refreshToken');
            const error = searchParams.get('error');
            const redirect = searchParams.get('redirect') || '/';

            if (error) {
                console.error('Auth callback error:', error);
                navigate('/signin', { state: { error: `Authentication failed: ${error}` } });
                return;
            }

            if (token && refreshToken) {
                try {
                    localStorage.setItem('token', token);
                    localStorage.setItem('refreshToken', refreshToken);

                    // Get user data
                    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:12001/api';
                    const response = await fetch(`${apiUrl}/auth/me`, {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });

                    if (response.ok) {
                        const userData = await response.json();
                        updateUser(userData.user);
                        navigate(decodeURIComponent(redirect));
                    } else {
                        throw new Error('Failed to get user data');
                    }
                } catch (err) {
                    console.error('Login error:', err);
                    navigate('/signin', { state: { error: 'Failed to authenticate. Please try again.' } });
                }
            } else {
                navigate('/signin', { state: { error: 'Missing authentication tokens.' } });
            }
        };

        handleCallback();
    }, [searchParams, navigate, updateUser]);

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            background: 'var(--primary-bg)',
            color: 'var(--text-primary)',
            gap: '1rem'
        }}>
            <Loader2 className="animate-spin" size={24} />
            <p>Processing authentication...</p>
        </div>
    );
};

export default AuthCallback;