import React from 'react'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || 'Unknown error' }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--bg-primary)', color: 'var(--text-primary)', padding: '2rem', textAlign: 'center'
        }}>
          <div>
            <h2>Si è verificato un errore</h2>
            <p style={{ opacity: 0.7, marginTop: '0.5rem' }}>{this.state.message}</p>
            <button
              onClick={() => window.location.reload()}
              style={{ marginTop: '1rem', padding: '0.6rem 1rem', background: 'var(--accent-blue)', color: '#fff', borderRadius: 6 }}
            >
              Ricarica
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

