/**
 * useDeepOrderBook Hook
 * Fetches deep orderbook data via REST API for scanner functionality
 * Complements WebSocket real-time data with periodic deep fetches
 */

import { useState, useEffect, useRef } from 'react'

/**
 * Fetch deep orderbook levels from Bybit REST API
 * Used for scanning big walls beyond WebSocket real-time range
 *
 * @param {string} symbol - Trading pair (e.g., 'BTCUSDT')
 * @param {boolean} enabled - Whether to fetch (allows pause/resume)
 * @param {number} intervalMs - Fetch interval in milliseconds (default: 10000)
 * @returns {Object} - { deepAsks, deepBids, isLoading, error, lastUpdate }
 */
export function useDeepOrderBook(symbol, enabled = true, intervalMs = 10000) {
  const [deepAsks, setDeepAsks] = useState([])
  const [deepBids, setDeepBids] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)

  const intervalRef = useRef(null)
  const abortControllerRef = useRef(null)

  // Fetch function
  const fetchDeepOrderbook = async () => {
    if (!enabled) return

    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    abortControllerRef.current = new AbortController()

    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(
        `https://api.bybit.com/v5/market/orderbook?category=linear&symbol=${symbol}&limit=500`,
        { signal: abortControllerRef.current.signal }
      )

      const data = await response.json()

      if (data.retCode === 0 && data.result) {
        const { a: asks, b: bids } = data.result

        // Convert to [price, size] format (same as WebSocket)
        const formattedAsks = asks.map(([price, size]) => [price, size])
        const formattedBids = bids.map(([price, size]) => [price, size])

        setDeepAsks(formattedAsks)
        setDeepBids(formattedBids)
        setLastUpdate(Date.now())

        console.log(`[useDeepOrderBook] Fetched ${formattedAsks.length} asks, ${formattedBids.length} bids for ${symbol}`)
      } else {
        throw new Error(`Bybit API error: ${data.retMsg || 'Unknown error'}`)
      }
    } catch (err) {
      // Ignore abort errors (normal when switching symbols)
      if (err.name !== 'AbortError') {
        console.error('[useDeepOrderBook] Fetch error:', err)
        setError(err.message)
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Setup interval for periodic fetches
  useEffect(() => {
    if (!symbol || !enabled) {
      // Clear data when disabled
      setDeepAsks([])
      setDeepBids([])
      return
    }

    // Initial fetch
    fetchDeepOrderbook()

    // Setup interval for subsequent fetches
    intervalRef.current = setInterval(() => {
      fetchDeepOrderbook()
    }, intervalMs)

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [symbol, enabled, intervalMs])

  return {
    deepAsks,
    deepBids,
    isLoading,
    error,
    lastUpdate
  }
}
