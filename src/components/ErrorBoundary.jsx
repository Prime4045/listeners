import React from 'react';

class ErrorBoundary extends React.Component {
    state = { hasError: false, error: null };

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Error caught by boundary:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '20px', textAlign: 'center', color: '#fff', background: '#1a1a1a' }}>
                    <h1>Something went wrong</h1>
                    <p>{this.state.error?.message || 'An unexpected error occurred.'}</p>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            padding: '10px 20px',
                            background: '#1db954',
                            border: 'none',
                            borderRadius: '20px',
                            color: '#fff',
                            cursor: 'pointer',
                        }}
                    >
                        Reload Page
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
