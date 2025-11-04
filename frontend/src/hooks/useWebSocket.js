import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Custom hook for WebSocket connection to BullBook backend
 * Handles connection, reconnection, and message parsing
 */
export function useWebSocket(url) {
  const [isConnected, setIsConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState(null)
  const [error, setError] = useState(null)
  const wsRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)
  const reconnectAttemptsRef = useRef(0)

  const MAX_RECONNECT_ATTEMPTS = 10
  const RECONNECT_DELAY = 3000 // 3 seconds

  const connect = useCallback(() => {
    try {
      // Use wss:// for production, ws:// for local dev
      const wsUrl = url || (window.location.protocol === 'https:'
        ? `wss://${window.location.host}/ws`
        : `ws://${window.location.hostname}:3001/ws`)

      console.log('[WebSocket] Connecting to:', wsUrl)
      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        console.log('[WebSocket] Connected')
        setIsConnected(true)
        setError(null)
        reconnectAttemptsRef.current = 0
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          setLastMessage(data)
        } catch (err) {
          console.error('[WebSocket] Failed to parse message:', err)
        }
      }

      ws.onerror = (err) => {
        console.error('[WebSocket] Error:', err)
        setError('WebSocket connection error')
      }

      ws.onclose = () => {
        console.log('[WebSocket] Disconnected')
        setIsConnected(false)
        wsRef.current = null

        // Attempt reconnection
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current++
          console.log(`[WebSocket] Reconnecting... (attempt ${reconnectAttemptsRef.current})`)
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, RECONNECT_DELAY)
        } else {
          setError('Max reconnection attempts reached')
        }
      }

      wsRef.current = ws
    } catch (err) {
      console.error('[WebSocket] Connection failed:', err)
      setError(err.message)
    }
  }, [url])

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
  const subscribe = useCallback((symbols) => {
    return sendMessage({
      action: 'subscribe',
      symbols: Array.isArray(symbols) ? symbols : [symbols]
    })
  }, [sendMessage])

  // Unsubscribe from symbols
  const unsubscribe = useCallback((symbols) => {
    return sendMessage({
      action: 'unsubscribe',
      symbols: Array.isArray(symbols) ? symbols : [symbols]
    })
  }, [sendMessage])

  // Connect on mount
  useEffect(() => {
    connect()

    // Cleanup on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [connect])

  return {
    isConnected,
    lastMessage,
    error,
    sendMessage,
    subscribe,
    unsubscribe
  }
}
