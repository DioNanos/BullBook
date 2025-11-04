import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import './Login.css'

export function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const { login } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    const result = await login(username, password)

    if (!result.success) {
      setError(result.error)
      setIsLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <h1>🐂 BullBook</h1>
          <p className="login-subtitle">Bybit Perpetual OrderBook</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              disabled={isLoading}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              disabled={isLoading}
              required
            />
          </div>

          {error && (
            <div className="login-error">
              🔴 {error}
            </div>
          )}

          <button type="submit" className="login-button" disabled={isLoading}>
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>

      <footer className="login-footer">
        <div className="login-footer-content">
          <span className="login-footer-text">🐂 BullBook - Bybit Perpetual OrderBook</span>
          <span className="login-footer-separator">|</span>
          <a
            href="https://github.com/DioNanos/BullBook"
            target="_blank"
            rel="noopener noreferrer"
            className="login-footer-link"
          >
            ⭐ Star on GitHub
          </a>
        </div>
      </footer>
    </div>
  )
}
