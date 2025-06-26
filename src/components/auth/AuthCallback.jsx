import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

const AuthCallback = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { login } = useAuth();

    useEffect(() => {
        const handleCallback = async () => {
            const token = searchParams.get('token');
            const refreshToken = searchParams.get('refreshToken');
            const error = searchParams.get('error');
            const redirect = searchParams.get('redirect') || '/dashboard';

            if (error) {
                console.error('Auth callback error:', error);
                navigate('/login', { state: { error: `Authentication failed: ${error}` } });
                return;
            }

            if (token && refreshToken) {
                try {
                    localStorage.setItem('token', token);
                    localStorage.setItem('refreshToken', refreshToken);

                    await login();

                    navigate(decodeURIComponent(redirect));
                } catch (err) {
                    console.error('Login error:', err);
                    navigate('/login', { state: { error: 'Failed to authenticate. Please try again.' } });
                }
            } else {
                navigate('/login', { state: { error: 'Missing authentication tokens.' } });
            }
        };

        handleCallback();
    }, [searchParams, navigate, login]);

    return (
        <div className="loading-screen">
            <Loader2 className="animate-spin" size={24} />
            <p>Processing authentication...</p>
        </div>
    );
};

export default AuthCallback;