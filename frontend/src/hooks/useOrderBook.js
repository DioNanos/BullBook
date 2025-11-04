import { useState, useEffect, useCallback } from 'react'
import { useWebSocket } from '../context/WebSocketContext'

/**
 * Custom hook for OrderBook management
 * Handles snapshot and delta updates from Bybit (L50 or L200)
 */
export function useOrderBook(symbol, depth = 50) {
  const [orderBook, setOrderBook] = useState({
    bids: [], // Array of [price, size]
    asks: [], // Array of [price, size]
    timestamp: null,
    updateId: null,
    lastUpdate: null // Local timestamp of last update
  })
  const [isLoading, setIsLoading] = useState(true)
  const [paused, setPaused] = useState(false) // Pause/resume updates

  const { isConnected, lastMessageTime, subscribe, unsubscribe, addListener, removeListener } = useWebSocket()

  // Toggle pause state
  const togglePaused = useCallback(() => {
    setPaused(prev => !prev)
  }, [])

  // Apply snapshot update (full orderbook)
  const applySnapshot = useCallback((data) => {
    const updateId = data.u || 0

    // Bybit docs: if u=1, it indicates service restart
    if (updateId === 1) {
      console.warn(`[useOrderBook ${symbol} L${depth}] ⚠️ Bybit service restart detected (u=1)`)
    }

    setOrderBook({
      bids: data.b || [],
      asks: data.a || [],
      timestamp: data.ts || Date.now(),
      updateId,
      lastUpdate: Date.now()
    })
    setIsLoading(false)
  }, [symbol, depth])

  // Apply delta update (incremental changes)
  const applyDelta = useCallback((data, currentBook) => {
    const updateId = data.u || currentBook.updateId

    // Bybit docs: if u=1 in delta, treat as snapshot (service restart)
    if (updateId === 1) {
      console.warn(`[useOrderBook ${symbol} L${depth}] ⚠️ Delta with u=1 - forcing snapshot reset`)
      return {
        bids: data.b || [],
        asks: data.a || [],
        timestamp: data.ts || Date.now(),
        updateId,
        lastUpdate: Date.now()
      }
    }

    const newBook = { ...currentBook }

    // Update bids
    if (data.b && data.b.length > 0) {
      const bidMap = new Map(newBook.bids.map(([price, size]) => [price, size]))

      data.b.forEach(([price, size]) => {
        if (parseFloat(size) === 0) {
          bidMap.delete(price) // Remove if size is 0 (Bybit docs: complete cancellation)
        } else {
          bidMap.set(price, size) // Update or add
        }
      })

      // Convert back to array and sort (descending by price)
      // Keep all levels up to depth (50, 200, or 1000)
      newBook.bids = Array.from(bidMap.entries())
        .sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]))
        .slice(0, depth)
    }

    // Update asks
    if (data.a && data.a.length > 0) {
      const askMap = new Map(newBook.asks.map(([price, size]) => [price, size]))

      data.a.forEach(([price, size]) => {
        if (parseFloat(size) === 0) {
          askMap.delete(price) // Remove if size is 0 (Bybit docs: complete cancellation)
        } else {
          askMap.set(price, size) // Update or add
        }
      })

      // Convert back to array and sort (ascending by price)
      // Keep all levels up to depth (50, 200, or 1000)
      newBook.asks = Array.from(askMap.entries())
        .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
        .slice(0, depth)
    }

    newBook.timestamp = data.ts || Date.now()
    newBook.updateId = updateId
    newBook.lastUpdate = Date.now()

    return newBook
  }, [symbol, depth])

  // Process incoming messages via listener
  useEffect(() => {
    const listenerId = `orderbook-${symbol}-${depth}`

    const handleMessage = (message) => {
      // Skip processing if paused
      if (paused) {
        return
      }

      const { topic, type, data } = message

      // Check if message is for our symbol AND depth
      if (!topic || !topic.includes(symbol) || !topic.includes(`orderbook.${depth}.`)) {
        return
      }

      console.log(`[useOrderBook ${symbol} L${depth}] Processing ${type}`, { bids: data?.b?.length || 0, asks: data?.a?.length || 0 })

      if (type === 'snapshot') {
        // Full orderbook snapshot
        applySnapshot(data)
        console.log(`[useOrderBook ${symbol} L${depth}] Snapshot applied`)
      } else if (type === 'delta') {
        // Incremental update
        setOrderBook(current => applyDelta(data, current))
      }
    }

    addListener(listenerId, handleMessage)

    return () => {
      removeListener(listenerId)
    }
  }, [symbol, depth, paused, applySnapshot, applyDelta, addListener, removeListener])

  // Reset orderbook when symbol changes
  useEffect(() => {
    console.log(`[OrderBook] Symbol changed to ${symbol}, resetting orderbook`)
    setOrderBook({
      bids: [],
      asks: [],
      timestamp: null,
      updateId: null,
      lastUpdate: null
    })
    setIsLoading(true)
  }, [symbol])

  // Subscribe to symbol when connected (with depth)
  useEffect(() => {
    if (isConnected && symbol) {
      console.log(`[OrderBook] Subscribing to ${symbol} with depth ${depth}`)
      subscribe(symbol, depth)
      setIsLoading(true)

      return () => {
        console.log(`[OrderBook] Unsubscribing from ${symbol}`)
        unsubscribe(symbol, depth)
      }
    }
  }, [isConnected, symbol, depth, subscribe, unsubscribe])

  // Calculate if data is stale (>10 seconds since last update)
  const now = Date.now()
  const timeSinceUpdate = orderBook.lastUpdate ? now - orderBook.lastUpdate : Infinity
  const isStale = timeSinceUpdate > 10000 // 10 seconds

  return {
    orderBook,
    isLoading,
    isConnected,
    isStale,
    timeSinceUpdate,
    paused,
    togglePaused
  }
}
