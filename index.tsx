import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Error Boundary to catch runtime errors and prevent "White Screen of Death"
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("App Crash:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', backgroundColor: '#0f172a', color: '#fff', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', textAlign: 'center' }}>
          <div style={{ backgroundColor: '#ef4444', padding: '1rem', borderRadius: '50%', marginBottom: '1.5rem' }}>
            <svg style={{ width: '48px', height: '48px', color: 'white' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>System Error</h1>
          <p style={{ color: '#94a3b8', marginBottom: '2rem', maxWidth: '400px' }}>
            The application encountered a critical error. This usually happens due to a browser conflict or corrupted data.
          </p>
          
          <div style={{ marginBottom: '2rem', width: '100%', maxWidth: '600px' }}>
             <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem', textAlign: 'left' }}>Error Details:</p>
             <pre style={{ backgroundColor: '#1e293b', padding: '1rem', borderRadius: '0.5rem', overflow: 'auto', fontSize: '0.75rem', color: '#fca5a5', textAlign: 'left', maxHeight: '150px' }}>
                {this.state.error?.message || "Unknown Error"}
                {'\n'}{this.state.error?.stack}
             </pre>
          </div>

          <button 
            onClick={() => {
              localStorage.clear(); 
              window.location.href = '/'; // Hard reload to root
            }}
            style={{ 
              padding: '0.75rem 2rem', 
              backgroundColor: '#ef4444', 
              color: 'white', 
              border: 'none', 
              borderRadius: '0.5rem', 
              cursor: 'pointer', 
              fontWeight: 'bold',
              fontSize: '1rem',
              boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.5)'
            }}
          >
            Reset System & Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);