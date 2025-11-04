import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'

/**
 * WebSocket Context - Single shared WebSocket connection
 */
const WebSocketContext = createContext(null)

export function WebSocketProvider({ children }) {
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState(null)
  const [lastMessageTime, setLastMessageTime] = useState(null)
  const isConnectedRef = useRef(false)
  const lastMessageTimeRef = useRef(null)
  const wsRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)
  const heartbeatIntervalRef = useRef(null)
  const watchdogIntervalRef = useRef(null)
  const listenersRef = useRef(new Map()) // Map of symbol -> Set of callbacks
  // Queue subscribe requests if connection isn't OPEN; flush on next onopen
  const pendingSubscribesRef = useRef([])
  // Reconnect controls
  const connectAttemptRef = useRef(0)
  const connectingRef = useRef(false)

  const RECONNECT_DELAY = 1000 // 1 second (aggressive)
  const HEARTBEAT_INTERVAL = 5000 // 5 seconds
  const STALE_THRESHOLD = 30000 // 30 seconds (if no data, consider stale)

  // Register a listener for messages
  const addListener = useCallback((id, callback) => {
    listenersRef.current.set(id, callback)
  }, [])

  // Unregister a listener
  const removeListener = useCallback((id) => {
    listenersRef.current.delete(id)
  }, [])

  // Broadcast message to all listeners
  const broadcastMessage = useCallback((message) => {
    const now = Date.now()
    setLastMessageTime(now)
    lastMessageTimeRef.current = now
    listenersRef.current.forEach((callback) => {
      callback(message)
    })
  }, [])

  // Start heartbeat to keep connection alive
  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
    }

    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        console.log('[WebSocket] Sending heartbeat ping')
        wsRef.current.send(JSON.stringify({ type: 'ping' }))
      }
    }, HEARTBEAT_INTERVAL)
  }, [HEARTBEAT_INTERVAL])

  // Stop heartbeat
  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
      heartbeatIntervalRef.current = null
    }
  }, [])

  // Start watchdog to detect stale data
  const startWatchdog = useCallback(() => {
    if (watchdogIntervalRef.current) {
      clearInterval(watchdogIntervalRef.current)
    }

    watchdogIntervalRef.current = setInterval(() => {
      const now = Date.now()
      const last = lastMessageTimeRef.current
      const connected = isConnectedRef.current
      const timeSinceLastMessage = last ? now - last : Infinity

      if (timeSinceLastMessage > STALE_THRESHOLD && connected) {
        console.warn('[WebSocket] ⚠️ No data for', timeSinceLastMessage / 1000, 'seconds - forcing reconnect')
        if (wsRef.current) {
          wsRef.current.close()
        }
      }
    }, 10000)
  }, [])

  // Stop watchdog
  const stopWatchdog = useCallback(() => {
    if (watchdogIntervalRef.current) {
      clearInterval(watchdogIntervalRef.current)
      watchdogIntervalRef.current = null
    }
  }, [])

  const connect = useCallback(() => {
    if (connectingRef.current || (wsRef.current && wsRef.current.readyState === WebSocket.OPEN)) {
      return
    }
    connectingRef.current = true
    try {
      // Use wss:// for production, ws:// for local dev
      const wsUrl = window.location.protocol === 'https:'
        ? `wss://${window.location.host}/ws`
        : `ws://${window.location.hostname}:3001/ws`

      console.log('[WebSocket] Connecting to:', wsUrl)
      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        console.log('[WebSocket] Connected')
        setIsConnected(true)
        isConnectedRef.current = true
        setError(null)
        const now = Date.now()
        setLastMessageTime(now)
        lastMessageTimeRef.current = now
        connectAttemptRef.current = 0
        connectingRef.current = false
        startHeartbeat()
        startWatchdog()

        // Flush any queued subscribes
        if (pendingSubscribesRef.current.length > 0) {
          const queued = [...pendingSubscribesRef.current]
          pendingSubscribesRef.current = []
          queued.forEach(msg => {
            try {
              ws.send(JSON.stringify(msg))
            } catch (e) {
              console.warn('[WebSocket] Failed to flush queued subscribe:', e?.message || e)
            }
          })
        }
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          // Broadcast to all listeners instead of using state
          broadcastMessage(data)
        } catch (err) {
          console.error('[WebSocket] Failed to parse message:', err)
        }
      }

      ws.onerror = (err) => {
        // In browsers this is a generic Event; log as much as we can
        console.error('[WebSocket] Error event:', err)
        setError('WebSocket connection error')
      }

      ws.onclose = (event) => {
        console.log('[WebSocket] Disconnected', {
          code: event?.code,
          reason: event?.reason,
          wasClean: event?.wasClean
        })
        setIsConnected(false)
        isConnectedRef.current = false
        wsRef.current = null
        connectingRef.current = false
        stopHeartbeat()
        stopWatchdog()

        // Exponential backoff with jitter to avoid resource exhaustion
        const attempt = Math.min(connectAttemptRef.current + 1, 10)
        connectAttemptRef.current = attempt
        const base = RECONNECT_DELAY * Math.pow(2, attempt - 1)
        const max = 30000
        const delay = Math.min(base, max)
        const jitter = Math.random() * 0.2 * delay // ±20% jitter
        const finalDelay = Math.max(500, Math.floor(delay * 0.9 + jitter))

        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
        console.log(`[WebSocket] Reconnecting in ${finalDelay}ms (attempt ${attempt})...`)
        reconnectTimeoutRef.current = setTimeout(() => {
          connect()
        }, finalDelay)
      }

      wsRef.current = ws
    } catch (err) {
      console.error('[WebSocket] Connection failed:', err)
      setError(err.message)
      connectingRef.current = false
    }
  }, [broadcastMessage, startHeartbeat, startWatchdog, stopHeartbeat, stopWatchdog, RECONNECT_DELAY])

  // Send message to WebSocket
  const sendMessage = useCallback((message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
      return true
    }
    console.warn('[WebSocket] Not connected, cannot send message')
    return false
  }, [])

  // Subscribe to symbols
  const subscribe = useCallback((symbols, depth = 50) => {
    const msg = {
      action: 'subscribe',
      symbols: Array.isArray(symbols) ? symbols : [symbols],
      depth
    }
    const sent = sendMessage(msg)
    if (!sent) {
      // Queue only subscribes; avoid queueing unsubscribes across reconnects
      pendingSubscribesRef.current.push(msg)
    }
    return sent
  }, [sendMessage])

  // Unsubscribe from symbols
  const unsubscribe = useCallback((symbols, depth = 50) => {
    // If not connected, drop unsubscribe (state will resubscribe fresh on reopen)
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('[WebSocket] Not connected, dropping unsubscribe')
      return false
    }
    return sendMessage({
      action: 'unsubscribe',
      symbols: Array.isArray(symbols) ? symbols : [symbols],
      depth
    })
  }, [sendMessage])

  // Connect on mount
  useEffect(() => {
    connect()

    // Cleanup on unmount
    return () => {
      stopHeartbeat()
      stopWatchdog()
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  return (
    <WebSocketContext.Provider
      value={{
        isConnected,
        error,
        lastMessageTime,
        sendMessage,
        subscribe,
        unsubscribe,
        addListener,
        removeListener
      }}
    >
      {children}
    </WebSocketContext.Provider>
  )
}

export function useWebSocket() {
  const context = useContext(WebSocketContext)
  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider')
  }
  return context
}
