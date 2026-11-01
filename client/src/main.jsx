import React, { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import './index.css'
import App from './App.jsx'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Tactical System Crash:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          minHeight: '100dvh',
          background: '#0B0914',
          color: '#F4F1FF',
          padding: '28px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          fontFamily: 'sans-serif'
        }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</div>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#FF2A55', marginBottom: '8px' }}>
            TACTICAL RUNTIME ERROR
          </h2>
          <div style={{
            fontSize: '11px',
            color: '#A39AC2',
            background: 'rgba(255,42,85,0.08)',
            border: '1px solid rgba(255,42,85,0.2)',
            borderRadius: '8px',
            padding: '12px',
            maxWidth: '90%',
            wordBreak: 'break-all',
            fontFamily: 'monospace',
            marginBottom: '20px'
          }}>
            {this.state.error?.message || String(this.state.error)}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#7C4DFF',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 20px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            RELOAD SYSTEM
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
