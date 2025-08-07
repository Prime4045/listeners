import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import ApiService from '../services/api';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { updateUser } = useAuth();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const token = searchParams.get('token');
        const refreshToken = searchParams.get('refreshToken');
        const error = searchParams.get('error');
        const redirect = searchParams.get('redirect') || '/';

        console.log('Auth callback params:', { token: !!token, refreshToken: !!refreshToken, error });

        if (error) {
          console.error('Auth callback error:', error);
          navigate('/signin?error=' + encodeURIComponent(error));
          return;
        }

        if (token && refreshToken) {
          console.log('🔑 Storing tokens and getting user data...');
          
          // Store tokens first
          localStorage.setItem('token', token);
          localStorage.setItem('refreshToken', refreshToken);

          // Get user data using ApiService
          try {
            const userData = await ApiService.getCurrentUser();
            console.log('✅ User data retrieved:', userData.user.username);
            updateUser(userData.user);
            navigate(decodeURIComponent(redirect));
          } catch (userError) {
            console.error('❌ Failed to get user data:', userError);
            // Clear invalid tokens
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            navigate('/signin?error=' + encodeURIComponent('Failed to get user data'));
          }
        } else {
          console.error('❌ Missing tokens in callback');
          navigate('/signin?error=' + encodeURIComponent('Missing authentication tokens'));
        }
      } catch (err) {
        console.error('❌ Auth callback error:', err);
        navigate('/signin?error=' + encodeURIComponent('Authentication failed'));
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