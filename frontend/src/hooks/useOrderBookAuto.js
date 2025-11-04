import { useState, useEffect, useCallback, useMemo } from 'react'
import { useWebSocket } from '../context/WebSocketContext'
import {
  calculateAutoTickSize,
  calculateAdaptiveTickSize,
  selectSourceAutomatic,
  groupOrderbook,
  formatSourceInfo
} from '../utils/autoGrouping'

/**
 * Custom hook for OrderBook management with manual source selection
 *
 * @param {string} symbol - Trading symbol (e.g. 'BTCUSDT')
 * @param {object} tickConfig - Tick size configuration
 * @param {string} tickConfig.mode - 'auto' or 'manual'
 * @param {number} tickConfig.value - Manual tick size (when mode='manual')
 * @param {number} maxLevels - Maximum levels to show per side (default: 10)
 * @param {string} manualSource - Manual source selection ('L50', 'L200', 'L1000')
 */
export function useOrderBookAuto(symbol, tickConfig = { mode: 'auto', value: 1 }, maxLevels = 10, manualSource = 'L200') {
  const [rawOrderBook, setRawOrderBook] = useState({
    bids: [],
    asks: [],
    timestamp: null,
    updateId: null,
    lastUpdate: null
  })
  const [isLoading, setIsLoading] = useState(true)
  const [paused, setPaused] = useState(false)
  const [currentPrice, setCurrentPrice] = useState(null)

  const { isConnected, subscribe, unsubscribe, addListener, removeListener } = useWebSocket()

  // Calculate effective tick size based on mode
  const effectiveTickSize = useMemo(() => {
    if (tickConfig.mode === 'auto') {
      if (!currentPrice) return 1; // Default until we have price
      return calculateAutoTickSize(currentPrice);
    }
    return tickConfig.value;
  }, [tickConfig.mode, tickConfig.value, currentPrice])

  // Use manual source selection (no automatic selection)
  const sourceInfo = useMemo(() => {
    const depths = { L50: 50, L200: 200, L1000: 1000 };
    return {
      source: manualSource,
      depth: depths[manualSource],
      ...formatSourceInfo(manualSource)
    };
  }, [manualSource])

  // Toggle pause state
  const togglePaused = useCallback(() => {
    setPaused(prev => !prev)
  }, [])

  // Apply snapshot update (full orderbook)
  const applySnapshot = useCallback((data) => {
    const updateId = data.u || 0

    if (updateId === 1) {
      console.warn(`[useOrderBookAuto ${symbol} ${sourceInfo.source}] ⚠️ Bybit service restart detected (u=1)`)
    }

    const newBook = {
      bids: data.b || [],
      asks: data.a || [],
      timestamp: data.ts || Date.now(),
      updateId,
      lastUpdate: Date.now()
    }

    // Update current price from best bid
    if (newBook.bids.length > 0) {
      setCurrentPrice(parseFloat(newBook.bids[0][0]))
    }

    setRawOrderBook(newBook)
    setIsLoading(false)
  }, [symbol, sourceInfo.source])

  // Apply delta update (incremental changes)
  const applyDelta = useCallback((data, currentBook) => {
    const updateId = data.u || currentBook.updateId

    if (updateId === 1) {
      console.warn(`[useOrderBookAuto ${symbol} ${sourceInfo.source}] ⚠️ Delta with u=1 - forcing snapshot reset`)
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
          bidMap.delete(price)
        } else {
          bidMap.set(price, size)
        }
      })

      newBook.bids = Array.from(bidMap.entries())
        .sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]))
        .slice(0, sourceInfo.depth)
    }

    // Update asks
    if (data.a && data.a.length > 0) {
      const askMap = new Map(newBook.asks.map(([price, size]) => [price, size]))

      data.a.forEach(([price, size]) => {
        if (parseFloat(size) === 0) {
          askMap.delete(price)
        } else {
          askMap.set(price, size)
        }
      })

      newBook.asks = Array.from(askMap.entries())
        .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
        .slice(0, sourceInfo.depth)
    }

    newBook.timestamp = data.ts || Date.now()
    newBook.updateId = updateId
    newBook.lastUpdate = Date.now()

    // Update current price
    if (newBook.bids.length > 0) {
      setCurrentPrice(parseFloat(newBook.bids[0][0]))
    }

    return newBook
  }, [symbol, sourceInfo.source, sourceInfo.depth])

  // Process incoming messages
  useEffect(() => {
    const listenerId = `orderbook-${symbol}-${sourceInfo.depth}`

    const handleMessage = (message) => {
      if (paused) return

      const { topic, type, data } = message

      // Check if message is for our symbol AND depth
      if (!topic || !topic.includes(symbol) || !topic.includes(`orderbook.${sourceInfo.depth}.`)) {
        return
      }

      console.log(`[useOrderBookAuto ${symbol} ${sourceInfo.source}] Processing ${type}`, {
        bids: data?.b?.length || 0,
        asks: data?.a?.length || 0
      })

      if (type === 'snapshot') {
        applySnapshot(data)
        console.log(`[useOrderBookAuto ${symbol} ${sourceInfo.source}] Snapshot applied`)
      } else if (type === 'delta') {
        setRawOrderBook(current => applyDelta(data, current))
      }
    }

    addListener(listenerId, handleMessage)

    return () => {
      removeListener(listenerId)
    }
  }, [symbol, sourceInfo.depth, sourceInfo.source, paused, applySnapshot, applyDelta, addListener, removeListener])

  // Reset orderbook when symbol changes
  useEffect(() => {
    console.log(`[useOrderBookAuto] Symbol changed to ${symbol}, resetting orderbook`)
    setRawOrderBook({
      bids: [],
      asks: [],
      timestamp: null,
      updateId: null,
      lastUpdate: null
    })
    setCurrentPrice(null)
    setIsLoading(true)
  }, [symbol])

  // Subscribe to symbol when connected (with auto-selected depth)
  useEffect(() => {
    if (isConnected && symbol) {
      console.log(`[useOrderBookAuto] Subscribing to ${symbol} with ${sourceInfo.source} (depth ${sourceInfo.depth})`)
      subscribe(symbol, sourceInfo.depth)
      setIsLoading(true)

      return () => {
        console.log(`[useOrderBookAuto] Unsubscribing from ${symbol}`)
        unsubscribe(symbol, sourceInfo.depth)
      }
    }
  }, [isConnected, symbol, sourceInfo.depth, sourceInfo.source, subscribe, unsubscribe])

  // Group orderbook by tick size
  const groupedOrderBook = useMemo(() => {
    return groupOrderbook(rawOrderBook, effectiveTickSize, maxLevels)
  }, [rawOrderBook, effectiveTickSize, maxLevels])

  // Calculate if data is stale
  const now = Date.now()
  const timeSinceUpdate = rawOrderBook.lastUpdate ? now - rawOrderBook.lastUpdate : Infinity
  const isStale = timeSinceUpdate > 10000

  return {
    // Grouped orderbook (ready for display)
    orderBook: groupedOrderBook,

    // Raw orderbook (if needed)
    rawOrderBook,

    // Tick and source info
    tickSize: effectiveTickSize,
    source: sourceInfo.source,
    sourceIcon: sourceInfo.icon,
    sourceLatency: sourceInfo.latency,
    estimatedLevels: sourceInfo.estimatedLevels,
    sourceWarning: sourceInfo.warning,

    // Current price
    currentPrice,

    // State
    isLoading,
    isConnected,
    isStale,
    timeSinceUpdate,
    paused,
    togglePaused
  }
}
