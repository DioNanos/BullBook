import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { WebSocketProvider } from './context/WebSocketContext'
import { Login } from './components/Login'
import { OrderBook } from './components/OrderBook'
import './App.css'

function AppContent() {
  const { user, isLoading, logout } = useAuth()
  const [status, setStatus] = useState('Loading...')

  // Preset system: initialize with lazy function to avoid re-renders
  const [currentSymbols, setCurrentSymbols] = useState(() => {
    // Try to load from localStorage first
    const saved = localStorage.getItem('bullbook_current_symbols')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        console.error('[App] Failed to load symbols:', e)
      }
    }
    // Fallback to defaults
    return ['BTCUSDT', 'ETHUSDT', 'SOLUSDT']
  })

  // Per-book settings for L source and tick (independent for each book)
  const [manualSources, setManualSources] = useState(() => {
    const saved = localStorage.getItem('bullbook_manual_sources')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        console.error('[App] Failed to load manual sources:', e)
      }
    }
    // Default: L200 for all books
    return ['L200', 'L200', 'L200']
  })

  const [tickSizeModes, setTickSizeModes] = useState(() => {
    const saved = localStorage.getItem('bullbook_tick_modes')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        console.error('[App] Failed to load tick modes:', e)
      }
    }
    // Default: auto for all books
    return ['auto', 'auto', 'auto']
  })

  const [manualTickSizes, setManualTickSizes] = useState(() => {
    const saved = localStorage.getItem('bullbook_manual_ticks')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        console.error('[App] Failed to load manual ticks:', e)
      }
    }
    // Default: 1 for all books
    return [1, 1, 1]
  })

  const [activePreset, setActivePreset] = useState(() => {
    // Load active preset from localStorage (persistent across refreshes)
    const saved = localStorage.getItem('bullbook_active_preset')
    return saved ? parseInt(saved) : null
  })

  // Auto-save activePreset to localStorage when it changes
  useEffect(() => {
    if (activePreset !== null) {
      localStorage.setItem('bullbook_active_preset', activePreset.toString())
    } else {
      localStorage.removeItem('bullbook_active_preset')
    }
  }, [activePreset])

  // Auto-save L sources to localStorage when they change
  useEffect(() => {
    localStorage.setItem('bullbook_manual_sources', JSON.stringify(manualSources))
  }, [manualSources])

  // Auto-save tick modes to localStorage when they change
  useEffect(() => {
    localStorage.setItem('bullbook_tick_modes', JSON.stringify(tickSizeModes))
  }, [tickSizeModes])

  // Auto-save manual tick sizes to localStorage when they change
  useEffect(() => {
    localStorage.setItem('bullbook_manual_ticks', JSON.stringify(manualTickSizes))
  }, [manualTickSizes])

  // Test backend health
  const testBackend = async () => {
    try {
      const response = await fetch('/health')
      const data = await response.json()
      setStatus(`🟢 Backend: ${data.status} | Bybit: ${data.bybit}`)
    } catch (error) {
      setStatus(`🔴 Backend Error: ${error.message}`)
    }
  }

  // Auto-load status on mount
  useEffect(() => {
    testBackend()
    const interval = setInterval(testBackend, 10000)
    return () => clearInterval(interval)
  }, [])

  // Save preset to localStorage (1-5)
  const savePreset = (slot) => {
    if (slot < 1 || slot > 5) return

    const preset = {
      symbols: currentSymbols,
      manualSources: manualSources,
      tickSizeModes: tickSizeModes,
      manualTickSizes: manualTickSizes,
      timestamp: Date.now()
    }

    localStorage.setItem(`bullbook_preset_${slot}`, JSON.stringify(preset))
    setActivePreset(slot)
    console.log(`[Preset] Saved slot ${slot}:`, preset)
  }

  // Load preset from localStorage (1-5)
  const loadPreset = (slot) => {
    if (slot < 1 || slot > 5) return

    const saved = localStorage.getItem(`bullbook_preset_${slot}`)
    if (!saved) {
      console.log(`[Preset] Slot ${slot} is empty`)
      return
    }

    // Auto-save current state to backup if unsaved changes
    if (activePreset === null) {
      const backup = {
        symbols: currentSymbols,
        manualSources: manualSources,
        tickSizeModes: tickSizeModes,
        manualTickSizes: manualTickSizes,
        timestamp: Date.now()
      }
      localStorage.setItem('bullbook_preset_backup', JSON.stringify(backup))
      console.log('[Preset] Auto-saved current state to backup')
    }

    try {
      const preset = JSON.parse(saved)
      setCurrentSymbols(preset.symbols)

      // Handle both old single-value and new array format
      setManualSources(preset.manualSources || [preset.manualSource || 'L200', 'L200', 'L200'])
      setTickSizeModes(preset.tickSizeModes || [preset.tickSizeMode || 'auto', 'auto', 'auto'])
      setManualTickSizes(preset.manualTickSizes || [preset.manualTickSize || 1, 1, 1])
      setActivePreset(slot)

      // Save to current state
      localStorage.setItem('bullbook_current_symbols', JSON.stringify(preset.symbols))
      localStorage.setItem('bullbook_manual_sources', JSON.stringify(preset.manualSources || [preset.manualSource || 'L200', 'L200', 'L200']))
      localStorage.setItem('bullbook_tick_modes', JSON.stringify(preset.tickSizeModes || [preset.tickSizeMode || 'auto', 'auto', 'auto']))
      localStorage.setItem('bullbook_manual_ticks', JSON.stringify(preset.manualTickSizes || [preset.manualTickSize || 1, 1, 1]))

      console.log(`[Preset] Loaded slot ${slot}:`, preset)
    } catch (e) {
      console.error(`[Preset] Failed to load slot ${slot}:`, e)
    }
  }

  // Check if a preset slot has data
  const isSlotFilled = (slot) => {
    return localStorage.getItem(`bullbook_preset_${slot}`) !== null
  }

  // Handle symbol change from OrderBook
  const handleSymbolChange = (index, newSymbol) => {
    const newSymbols = [...currentSymbols]
    newSymbols[index] = newSymbol
    setCurrentSymbols(newSymbols)
    setActivePreset(null) // Mark as modified

    // Save to localStorage immediately
    localStorage.setItem('bullbook_current_symbols', JSON.stringify(newSymbols))
  }

  // Handle L source change for specific book (mark preset as modified)
  const handleManualSourceChange = (index, newSource) => {
    const newSources = [...manualSources]
    newSources[index] = newSource
    setManualSources(newSources)
    setActivePreset(null) // Mark as modified
  }

  // Handle tick mode change for specific book (mark preset as modified)
  const handleTickSizeModeChange = (index, newMode) => {
    const newModes = [...tickSizeModes]
    newModes[index] = newMode
    setTickSizeModes(newModes)
    setActivePreset(null) // Mark as modified
  }

  // Handle manual tick size change for specific book (mark preset as modified)
  const handleManualTickSizeChange = (index, newSize) => {
    const newSizes = [...manualTickSizes]
    newSizes[index] = newSize
    setManualTickSizes(newSizes)
    setActivePreset(null) // Mark as modified
  }

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="app">
        <div className="loading-screen">
          <h1>🐂 BullBook</h1>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  // Show login if not authenticated
  if (!user) {
    return <Login />
  }

  // Get user preferences or use defaults
  const depth = user.preferences?.depth || 50
  const priceDecimals = user.preferences?.priceDecimals || 2
  const sizeDecimals = user.preferences?.sizeDecimals || 3

  return (
    <WebSocketProvider>
      <div className="app">
        <header className="app-header">
          <div className="header-left">
            <h1>🐂 BullBook</h1>
            <p className="subtitle">Bybit Perpetual OrderBook</p>
          </div>
          <div className="header-right">
            <span className="user-badge">👤 {user.username}</span>
            <button onClick={logout} className="logout-btn">
              🚪 Logout
            </button>
          </div>
        </header>

        <div className="status-bar">
          <span>{status}</span>
          <span className="status-separator">|</span>
          <div className="preset-buttons">
            {[1, 2, 3, 4, 5].map(slot => (
              <button
                key={slot}
                className={`preset-btn ${activePreset === slot ? 'active' : ''} ${isSlotFilled(slot) ? 'filled' : ''}`}
                onClick={() => loadPreset(slot)}
                title={`Preset ${slot}${isSlotFilled(slot) ? ' (saved)' : ' (empty)'}`}
              >
                {slot}
              </button>
            ))}
            <button
              className="preset-save-btn"
              onClick={() => {
                const slot = prompt('Save to preset slot (1-5):')
                const slotNum = parseInt(slot)
                if (!isNaN(slotNum) && slotNum >= 1 && slotNum <= 5) {
                  savePreset(slotNum)
                }
              }}
              title="Save current books to preset"
            >
              💾
            </button>
          </div>
        </div>

        <main className="app-main orderbook-grid">
          {currentSymbols.map((symbol, index) => (
            <OrderBook
              key={`orderbook-${index}`}
              symbol={symbol}
              maxLevels={depth}
              priceDecimals={priceDecimals}
              sizeDecimals={sizeDecimals}
              onSymbolChange={(newSymbol) => handleSymbolChange(index, newSymbol)}
              manualSource={manualSources[index] || 'L200'}
              onManualSourceChange={(newSource) => handleManualSourceChange(index, newSource)}
              tickSizeMode={tickSizeModes[index] || 'auto'}
              onTickSizeModeChange={(newMode) => handleTickSizeModeChange(index, newMode)}
              manualTickSize={manualTickSizes[index] || 1}
              onManualTickSizeChange={(newSize) => handleManualTickSizeChange(index, newSize)}
            />
          ))}
        </main>

        <footer className="app-footer">
          <div className="footer-content">
            <span className="footer-text">🐂 BullBook v1.0 - Bybit Perpetual OrderBook</span>
            <span className="footer-separator">|</span>
            <a
              href="https://github.com/DioNanos/BullBook"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link footer-github"
            >
              ⭐ Star on GitHub
            </a>
          </div>
        </footer>
      </div>
    </WebSocketProvider>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
