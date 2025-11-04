import { useState, useRef, useEffect, useMemo } from 'react'
import { useOrderBookAuto } from '../hooks/useOrderBookAuto'
import { useDeepOrderBook } from '../hooks/useDeepOrderBook'
import { useMarketData } from '../hooks/useMarketData'
import { calculateSmartTickSize, findBiggestLevel, calculatePercentDistance, formatSmartPrice, formatBigSize, detectBigWalls } from '../utils/smartOrderBook'
import './OrderBook.css'

export function OrderBook({
  symbol: initialSymbol = 'BTCUSDT',
  maxLevels = 100, // Fetch 100 levels (ASKS will show all 100, BIDS will show 10 via CSS height)
  priceDecimals: initialPriceDecimals = 2,
  sizeDecimals: initialSizeDecimals = 3,
  onSymbolChange, // callback to notify parent of symbol change
  manualSource = 'L200', // Controlled from parent (global)
  onManualSourceChange, // callback to update parent state
  tickSizeMode = 'auto', // Controlled from parent (global)
  onTickSizeModeChange, // callback to update parent state
  manualTickSize = 1, // Controlled from parent (global)
  onManualTickSizeChange // callback to update parent state
}) {
  const [symbol, setSymbol] = useState(initialSymbol)
  const [showCoinSelector, setShowCoinSelector] = useState(false)
  const [asksSnapped, setAsksSnapped] = useState(true)
  const [bidsSnapped, setBidsSnapped] = useState(true)
  const [availableCoins, setAvailableCoins] = useState([])
  const [loadingCoins, setLoadingCoins] = useState(false)
  const [sortField, setSortField] = useState('change24h') // 'change24h', 'volume24h', 'symbol'
  const [sortDirection, setSortDirection] = useState('desc') // 'asc' or 'desc'
  const [searchQuery, setSearchQuery] = useState('') // Search filter for coin selector

  const asksRef = useRef(null)
  const bidsRef = useRef(null)
  const autoScrollingAsks = useRef(false)
  const autoScrollingBids = useRef(false)
  const maintainScrollIntervalRef = useRef(null)

  // Use auto hook with tick config and manual source
  const tickConfig = { mode: tickSizeMode, value: manualTickSize }
  const { orderBook, tickSize, source, sourceIcon, sourceLatency, isLoading, isConnected, isStale, timeSinceUpdate, paused, togglePaused, currentPrice } = useOrderBookAuto(symbol, tickConfig, maxLevels, manualSource)
  const { volatility, range24h, isLoading: isMarketDataLoading } = useMarketData(symbol)
  const { deepAsks, deepBids } = useDeepOrderBook(symbol, true, 10000) // Fetch every 10s

  // Tick size is now managed by useOrderBookAuto hook

  // Handle asks scroll - detect if user manually scrolled or if at bottom
  const handleAsksScroll = () => {
    if (!asksRef.current || autoScrollingAsks.current) return

    const { scrollTop, scrollHeight, clientHeight } = asksRef.current
    const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 10

    if (isAtBottom && !asksSnapped) {
      // User scrolled back to bottom manually - re-snap
      setAsksSnapped(true)
    } else if (!isAtBottom && asksSnapped) {
      // User scrolled away from bottom - unsnap
      setAsksSnapped(false)
    }
  }

  // Handle bids scroll - detect if user manually scrolled or if at top
  const handleBidsScroll = () => {
    if (!bidsRef.current || autoScrollingBids.current) return

    const { scrollTop } = bidsRef.current
    const isAtTop = scrollTop < 10

    if (isAtTop && !bidsSnapped) {
      // User scrolled back to top manually - re-snap
      setBidsSnapped(true)
    } else if (!isAtTop && bidsSnapped) {
      // User scrolled away from top - unsnap
      setBidsSnapped(false)
    }
  }

  // Auto-scroll asks to bottom when snapped (magnetic effect)
  // Only triggers when snap state changes or on mount, NOT on every data update
  useEffect(() => {
    if (!asksSnapped || !asksRef.current || orderBook.asks.length === 0) return

    // Check if already at bottom
    const { scrollTop, scrollHeight, clientHeight } = asksRef.current
    const isAlreadyAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 5

    if (!isAlreadyAtBottom) {
      autoScrollingAsks.current = true
      asksRef.current.scrollTop = asksRef.current.scrollHeight
      setTimeout(() => { autoScrollingAsks.current = false }, 50)
    }
  }, [asksSnapped]) // Only depend on snap state, not on every data update

  // Auto-scroll bids to top when snapped (magnetic effect)
  useEffect(() => {
    if (!bidsSnapped || !bidsRef.current || orderBook.bids.length === 0) return

    // Check if already at top
    const { scrollTop } = bidsRef.current
    const isAlreadyAtTop = scrollTop < 5

    if (!isAlreadyAtTop) {
      autoScrollingBids.current = true
      bidsRef.current.scrollTop = 0
      setTimeout(() => { autoScrollingBids.current = false }, 50)
    }
  }, [bidsSnapped]) // Only depend on snap state, not on every data update

  // Maintain scroll position when data updates (only if snapped - magnetic effect)
  useEffect(() => {
    // Clear any existing interval
    if (maintainScrollIntervalRef.current) {
      clearInterval(maintainScrollIntervalRef.current)
    }

    // Start interval to maintain scroll position when snapped
    maintainScrollIntervalRef.current = setInterval(() => {
      // Maintain asks at bottom if snapped
      if (asksSnapped && asksRef.current && !autoScrollingAsks.current) {
        const { scrollTop, scrollHeight, clientHeight } = asksRef.current
        const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 10

        if (!isAtBottom) {
          autoScrollingAsks.current = true
          asksRef.current.scrollTop = asksRef.current.scrollHeight
          setTimeout(() => { autoScrollingAsks.current = false }, 50)
        }
      }

      // Maintain bids at top if snapped
      if (bidsSnapped && bidsRef.current && !autoScrollingBids.current) {
        const { scrollTop } = bidsRef.current
        const isAtTop = scrollTop < 10

        if (!isAtTop) {
          autoScrollingBids.current = true
          bidsRef.current.scrollTop = 0
          setTimeout(() => { autoScrollingBids.current = false }, 50)
        }
      }
    }, 100) // Check every 100ms

    return () => {
      if (maintainScrollIntervalRef.current) {
        clearInterval(maintainScrollIntervalRef.current)
      }
    }
  }, [asksSnapped, bidsSnapped])

  // Reset snap when symbol changes
  useEffect(() => {
    setAsksSnapped(true)
    setBidsSnapped(true)
  }, [symbol])

  // Sync local symbol state when parent forces change (e.g. preset load)
  useEffect(() => {
    if (initialSymbol !== symbol) {
      setSymbol(initialSymbol)
    }
  }, [initialSymbol])

  // Fetch available coins from Bybit when selector opens
  useEffect(() => {
    if (showCoinSelector && availableCoins.length === 0) {
      fetchAvailableCoins()
    }
  }, [showCoinSelector])

  const fetchAvailableCoins = async () => {
    setLoadingCoins(true)
    try {
      // Fetch tickers from Bybit (24h data)
      const response = await fetch('https://api.bybit.com/v5/market/tickers?category=linear')
      const data = await response.json()

      if (data.retCode === 0 && data.result?.list) {
        // Filter USDT perpetuals - GET ALL (no limit)
        const usdtPairs = data.result.list
          .filter(ticker => ticker.symbol.endsWith('USDT'))
          .map(ticker => ({
            symbol: ticker.symbol,
            volume24h: parseFloat(ticker.turnover24h || 0),
            price: parseFloat(ticker.lastPrice || 0),
            change24h: parseFloat(ticker.price24hPcnt || 0) * 100
          }))
          // NO .slice() - show ALL available coins!

        console.log(`[OrderBook] Loaded ${usdtPairs.length} USDT pairs`)
        setAvailableCoins(usdtPairs)
      }
    } catch (error) {
      console.error('[OrderBook] Failed to fetch coins:', error)
    }
    setLoadingCoins(false)
  }

  // Sort and filter coins based on search query and sort field
  const getSortedCoins = () => {
    if (availableCoins.length === 0) return []

    // Filter by search query first
    let filtered = availableCoins
    if (searchQuery.trim()) {
      const query = searchQuery.toUpperCase()
      filtered = availableCoins.filter(coin =>
        coin.symbol.toUpperCase().includes(query)
      )
    }

    // Then sort
    const sorted = [...filtered].sort((a, b) => {
      let compareA, compareB

      switch (sortField) {
        case 'change24h':
          compareA = a.change24h
          compareB = b.change24h
          break
        case 'volume24h':
          compareA = a.volume24h
          compareB = b.volume24h
          break
        case 'symbol':
          compareA = a.symbol
          compareB = b.symbol
          break
        default:
          return 0
      }

      // Handle string comparison for symbol
      if (sortField === 'symbol') {
        return sortDirection === 'asc'
          ? compareA.localeCompare(compareB)
          : compareB.localeCompare(compareA)
      }

      // Numeric comparison
      return sortDirection === 'asc'
        ? compareA - compareB
        : compareB - compareA
    })

    return sorted
  }

  // Handle column header click for sorting
  const handleSortClick = (field) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // New field - default to desc for volume/change, asc for symbol
      setSortField(field)
      setSortDirection(field === 'symbol' ? 'asc' : 'desc')
    }
  }

  const handleCoinSelect = (newSymbol) => {
    setSymbol(newSymbol)
    setShowCoinSelector(false)
    setSearchQuery('') // Reset search on selection

    // Notify parent component of symbol change (for presets)
    if (onSymbolChange) {
      onSymbolChange(newSymbol)
    }
  }

  // Close coin selector and reset search
  const handleCloseCoinSelector = () => {
    setShowCoinSelector(false)
    setSearchQuery('') // Reset search on close
  }

  // Calculate total volume in USDT for each side
  const calculateTotalVolumeUSDT = (orders) => {
    return orders.reduce((sum, [price, size]) => {
      return sum + (parseFloat(price) * parseFloat(size))
    }, 0)
  }

  // Format price based on tick size
  const formatPrice = (price) => {
    const decimals = tickSize >= 1 ? 0 :
                     tickSize >= 0.1 ? 1 :
                     tickSize >= 0.01 ? 2 :
                     tickSize >= 0.001 ? 3 :
                     tickSize >= 0.0001 ? 4 :
                     tickSize >= 0.00001 ? 5 :
                     tickSize >= 0.000001 ? 6 :
                     tickSize >= 0.0000001 ? 7 : 8
    return parseFloat(price).toFixed(decimals)
  }

  // Format size with auto decimals (based on size magnitude)
  const formatSize = (size) => {
    const s = parseFloat(size)
    if (s >= 1000) return s.toFixed(0)
    if (s >= 100) return s.toFixed(1)
    if (s >= 10) return s.toFixed(2)
    if (s >= 1) return s.toFixed(3)
    if (s >= 0.1) return s.toFixed(4)
    return s.toFixed(5)
  }

  // Format USDT value with Italian formatting (1.234.567,89)
  const formatUSDT = (value) => {
    const v = parseFloat(value)
    if (isNaN(v)) return '0,00'

    // Determine decimals based on magnitude
    let decimals = 2
    if (v >= 1000) decimals = 0
    else if (v >= 100) decimals = 1

    // Format with Italian locale
    return v.toLocaleString('it-IT', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    })
  }

  // Calculate percentage bar width
  const calculateBarWidth = (size, maxSize) => {
    if (!maxSize || maxSize === 0) return 0
    return (parseFloat(size) / maxSize) * 100
  }

  // Calculate visual weight for level (bigger = more prominent)
  const calculateLevelWeight = (size, maxSize) => {
    if (!maxSize || maxSize === 0) return { opacity: 0.6, fontWeight: 400 }

    const ratio = parseFloat(size) / maxSize

    // Tiered opacity and font weight
    if (ratio > 0.7) return { opacity: 1.0, fontWeight: 700, fontSize: '1.0rem' }   // HUGE level
    if (ratio > 0.5) return { opacity: 0.95, fontWeight: 600, fontSize: '0.95rem' } // Big level
    if (ratio > 0.3) return { opacity: 0.85, fontWeight: 500, fontSize: '0.9rem' }  // Medium level
    if (ratio > 0.1) return { opacity: 0.7, fontWeight: 400, fontSize: '0.9rem' }   // Small level
    return { opacity: 0.5, fontWeight: 400, fontSize: '0.85rem' }                   // Tiny level
  }

  // Merge WebSocket (real-time, near spread) + REST API (deep, far from spread)
  // Strategy: Use WebSocket for levels within 1% of spread, REST API for levels beyond 1%
  const { mergedAsks, mergedBids } = useMemo(() => {
    if (!currentPrice || !orderBook.asks.length || !orderBook.bids.length) {
      return { mergedAsks: orderBook.asks, mergedBids: orderBook.bids }
    }

    // Calculate 1% threshold from current price
    const threshold = currentPrice * 0.01

    // Helper: check if level is within threshold
    const isNearSpread = (price) => Math.abs(parseFloat(price) - currentPrice) <= threshold

    // Filter WebSocket levels (near spread, real-time)
    const wsAsksNear = orderBook.asks.filter(([price]) => isNearSpread(price))
    const wsBidsNear = orderBook.bids.filter(([price]) => isNearSpread(price))

    // Filter REST API levels (far from spread, updated every 10s)
    const deepAsksFar = deepAsks.filter(([price]) => !isNearSpread(price))
    const deepBidsFar = deepBids.filter(([price]) => !isNearSpread(price))

    // Merge using Map to remove duplicates (price is key)
    const mergeAndDedupe = (near, far) => {
      const map = new Map()

      // Add near levels first (WebSocket priority for near spread)
      near.forEach(([price, size]) => {
        map.set(price, size)
      })

      // Add far levels (REST API for deep levels)
      far.forEach(([price, size]) => {
        if (!map.has(price)) {
          map.set(price, size)
        }
      })

      return Array.from(map.entries())
    }

    const asks = mergeAndDedupe(wsAsksNear, deepAsksFar)
    const bids = mergeAndDedupe(wsBidsNear, deepBidsFar)

    return { mergedAsks: asks, mergedBids: bids }
  }, [orderBook.asks, orderBook.bids, deepAsks, deepBids, currentPrice])

  // Calculate smart tick suggestion based on volatility
  const smartTick = volatility && currentPrice ? calculateSmartTickSize(currentPrice, volatility) : null

  // Detect big walls in merged orderbook
  const bigWallsAsks = useMemo(() => {
    return currentPrice ? detectBigWalls(mergedAsks, currentPrice) : []
  }, [mergedAsks, currentPrice])

  const bigWallsBids = useMemo(() => {
    return currentPrice ? detectBigWalls(mergedBids, currentPrice) : []
  }, [mergedBids, currentPrice])

  // Create Set of big wall prices for fast lookup
  const bigWallPrices = useMemo(() => {
    const prices = new Set()
    bigWallsAsks.forEach(wall => prices.add(wall.price.toString()))
    bigWallsBids.forEach(wall => prices.add(wall.price.toString()))
    return prices
  }, [bigWallsAsks, bigWallsBids])

  // Create map of price -> big wall info for type classification
  const bigWallsMap = useMemo(() => {
    const map = new Map()
    bigWallsAsks.forEach(wall => map.set(wall.price.toString(), wall))
    bigWallsBids.forEach(wall => map.set(wall.price.toString(), wall))
    return map
  }, [bigWallsAsks, bigWallsBids])

  // Find big levels (resistance in asks, support in bids) - use merged data
  // IMPORTANT: Filter by position relative to current price
  // Resistance: only asks ABOVE current price (price > currentPrice)
  // Support: only bids BELOW current price (price < currentPrice)
  const asksAbovePrice = currentPrice ? mergedAsks.filter(([price]) => parseFloat(price) > currentPrice) : mergedAsks
  const bidsBelowPrice = currentPrice ? mergedBids.filter(([price]) => parseFloat(price) < currentPrice) : mergedBids

  const biggestAsk = asksAbovePrice.length > 0 ? findBiggestLevel(asksAbovePrice) : null
  const biggestBid = bidsBelowPrice.length > 0 ? findBiggestLevel(bidsBelowPrice) : null

  // Calculate percentage distance for big levels
  const resistancePercent = biggestAsk && currentPrice ? calculatePercentDistance(biggestAsk.price, currentPrice) : null
  const supportPercent = biggestBid && currentPrice ? calculatePercentDistance(biggestBid.price, currentPrice) : null

  if (!isConnected) {
    return (
      <div className="orderbook">
        <div className="orderbook-header">
          <h3>{symbol}</h3>
          <span className="status-indicator offline">🔴 Disconnected</span>
        </div>
        <div className="orderbook-loading">
          Connecting to WebSocket...
        </div>
      </div>
    )
  }

  if (isLoading || !orderBook.bids.length || !orderBook.asks.length) {
    return (
      <div className="orderbook">
        <div className="orderbook-header">
          <h3>{symbol}</h3>
          <span className="status-indicator">🟡 Loading...</span>
        </div>
        <div className="orderbook-loading">
          Waiting for orderbook data...
        </div>
      </div>
    )
  }

  // OrderBook is already grouped by useOrderBookAuto hook
  // Just sort and prepare for display
  const sortedAsks = orderBook.asks.sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
  const sortedBids = orderBook.bids.sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]))

  // Show levels (hook already limits to maxLevels)
  const visibleAsks = sortedAsks.reverse() // Highest price on top, lowest (best ask) at bottom near spread
  const visibleBids = sortedBids // Highest price (best bid) on top near spread, lowest at bottom

  // Find max size for bar scaling
  const maxAskSize = Math.max(...visibleAsks.map(([_, size]) => parseFloat(size)), 0)
  const maxBidSize = Math.max(...visibleBids.map(([_, size]) => parseFloat(size)), 0)

  const totalBidVolume = calculateTotalVolumeUSDT(visibleBids)
  const totalAskVolume = calculateTotalVolumeUSDT(visibleAsks)

  // Calculate spread
  const bestBid = visibleBids[0] ? parseFloat(visibleBids[0][0]) : 0
  const bestAsk = visibleAsks[visibleAsks.length - 1] ? parseFloat(visibleAsks[visibleAsks.length - 1][0]) : 0 // Best ask is at the end now
  const spread = bestAsk - bestBid
  const spreadPercent = bestBid > 0 ? ((spread / bestBid) * 100).toFixed(3) : 0
  const midPrice = bestBid && bestAsk ? (bestBid + bestAsk) / 2 : (bestBid || bestAsk || currentPrice)

  return (
    <div className="orderbook">
      <div className="orderbook-header">
        <h3
          className="symbol-name clickable"
          onClick={() => setShowCoinSelector(true)}
          title="Click to change coin"
        >
          {symbol}
        </h3>
        <select
          value={manualSource}
          onChange={(e) => onManualSourceChange(e.target.value)}
          className="source-select"
          title={`Data source: ${source} (${sourceLatency}ms latency)`}
        >
          <option value="L50">L50</option>
          <option value="L200">L200</option>
          <option value="L1000">L1000</option>
        </select>
        <select
          value={tickSizeMode === 'auto' ? 'auto' : manualTickSize}
          onChange={(e) => {
            if (e.target.value === 'auto') {
              onTickSizeModeChange('auto')
            } else {
              onTickSizeModeChange('manual')
              onManualTickSizeChange(Number(e.target.value))
            }
          }}
          className="tick-size-select"
          title="Price grouping level"
        >
          <option value="auto">Auto{tickSizeMode === 'auto' ? ` (${tickSize})` : ''}</option>
          <option value={0.00000001}>0.00000001</option>
          <option value={0.0000001}>0.0000001</option>
          <option value={0.000001}>0.000001</option>
          <option value={0.00001}>0.00001</option>
          <option value={0.0001}>0.0001</option>
          <option value={0.001}>0.001</option>
          <option value={0.01}>0.01</option>
          <option value={0.1}>0.1</option>
          <option value={1}>1</option>
          <option value={10}>10</option>
          <option value={100}>100</option>
          <option value={1000}>1000</option>
        </select>
        <span
          className={`status-indicator clickable ${
            !isConnected ? 'offline' :
            paused ? 'paused' :
            isStale ? 'stale' :
            'online'
          }`}
          onClick={togglePaused}
          title={
            paused ? 'Paused - Click to resume' :
            timeSinceUpdate < Infinity ? `Live - Click to pause (Last update: ${(timeSinceUpdate / 1000).toFixed(1)}s ago)` :
            'No data yet'
          }
        >
          {!isConnected ? '🔴 Dead' :
           paused ? '⏸️ Paused' :
           isStale ? '🟡 Stale' :
           '🟢 Live'}
          {!paused && timeSinceUpdate < Infinity && timeSinceUpdate < 10000 && (
            <span style={{fontSize: '0.7em', opacity: 0.7}}> {(timeSinceUpdate / 1000).toFixed(0)}s</span>
          )}
        </span>
      </div>

      <div className="orderbook-columns">
        <div className="column-header price">Price(USDT)</div>
        <div className="column-header size">Amount(Coin)</div>
        <div className="column-header total">Value(USDT)</div>
        <div className="column-header distance">Distance%</div>
      </div>

      {/* Asks (Sell orders) - Red */}
      <div className="orderbook-asks" ref={asksRef} onScroll={handleAsksScroll}>
        {visibleAsks.map(([price, size], index) => {
          const priceNum = parseFloat(price)
          const sizeNum = parseFloat(size)

          // Value in USDT = size * price
          const valueUSDT = sizeNum * priceNum

          // Calculate distance from mid-price (symmetric for asks/bids)
          const distancePercent = midPrice ? ((priceNum - midPrice) / midPrice) * 100 : 0

          // Check if this is a big wall
          const isBigWall = bigWallPrices.has(price)
          const bigWallInfo = isBigWall ? bigWallsMap.get(price) : null

          const barWidth = calculateBarWidth(size, maxAskSize)
          const weight = calculateLevelWeight(size, maxAskSize)

          return (
            <div
              key={`ask-${price}`}
              className={`orderbook-row ask ${isBigWall ? 'big-wall' : ''}`}
              data-wall-type={bigWallInfo?.type || ''}
              style={{ opacity: weight.opacity }}
            >
              <div className="volume-bar ask-bar" style={{ width: `${barWidth}%` }} />
              <div className="price ask-price" style={{ fontWeight: weight.fontWeight, fontSize: weight.fontSize }}>
                {isBigWall && <span className="wall-icon">🧱</span>}
                {formatPrice(price)}
              </div>
              <div className="size" style={{ fontWeight: weight.fontWeight, fontSize: weight.fontSize }}>{formatSize(size)}</div>
              <div className="total" style={{ fontSize: weight.fontSize }}>{formatUSDT(valueUSDT)}</div>
              <div className="distance ask-distance" style={{ fontSize: weight.fontSize }}>
                {distancePercent > 0 ? '+' : ''}{distancePercent.toFixed(2)}%
              </div>
            </div>
          )
        })}
      </div>

      {/* Spread indicator */}
      <div className="orderbook-spread">
        <span className="spread-value">{formatPrice(bestAsk)}</span>
        <span className="spread-info">
          Spread: {spread.toFixed(2)} ({spreadPercent}%)
        </span>
        <span className="spread-value">{formatPrice(bestBid)}</span>
      </div>

      {/* Bids (Buy orders) - Green */}
      <div className="orderbook-bids" ref={bidsRef} onScroll={handleBidsScroll}>
        {visibleBids.map(([price, size], index) => {
          const priceNum = parseFloat(price)
          const sizeNum = parseFloat(size)

          // Value in USDT = size * price
          const valueUSDT = sizeNum * priceNum

          // Calculate distance from mid-price (symmetric for asks/bids)
          const distancePercent = midPrice ? ((priceNum - midPrice) / midPrice) * 100 : 0

          // Check if this is a big wall
          const isBigWall = bigWallPrices.has(price)
          const bigWallInfo = isBigWall ? bigWallsMap.get(price) : null

          const barWidth = calculateBarWidth(size, maxBidSize)
          const weight = calculateLevelWeight(size, maxBidSize)

          return (
            <div
              key={`bid-${price}`}
              className={`orderbook-row bid ${isBigWall ? 'big-wall' : ''}`}
              data-wall-type={bigWallInfo?.type || ''}
              style={{ opacity: weight.opacity }}
            >
              <div className="volume-bar bid-bar" style={{ width: `${barWidth}%` }} />
              <div className="price bid-price" style={{ fontWeight: weight.fontWeight, fontSize: weight.fontSize }}>
                {isBigWall && <span className="wall-icon">🧱</span>}
                {formatPrice(price)}
              </div>
              <div className="size" style={{ fontWeight: weight.fontWeight, fontSize: weight.fontSize }}>{formatSize(size)}</div>
              <div className="total" style={{ fontSize: weight.fontSize }}>{formatUSDT(valueUSDT)}</div>
              <div className="distance bid-distance" style={{ fontSize: weight.fontSize }}>
                {distancePercent > 0 ? '+' : ''}{distancePercent.toFixed(2)}%
              </div>
            </div>
          )
        })}
      </div>

      {/* Big Levels Display - ALWAYS VISIBLE */}
      <div className="big-levels">
        <div className="big-level resistance">
          🔴 Resistance:{' '}
          {biggestAsk && resistancePercent !== null ? (
            <>
              ${formatSmartPrice(biggestAsk.price, tickSize)} ({formatBigSize(biggestAsk.size)}) ({resistancePercent > 0 ? '+' : ''}{resistancePercent.toFixed(2)}%)
            </>
          ) : (
            <span className="no-level">(none detected)</span>
          )}
        </div>
        <div className="big-level support">
          🟢 Support:{' '}
          {biggestBid && supportPercent !== null ? (
            <>
              ${formatSmartPrice(biggestBid.price, tickSize)} ({formatBigSize(biggestBid.size)}) ({supportPercent > 0 ? '+' : ''}{supportPercent.toFixed(2)}%)
            </>
          ) : (
            <span className="no-level">(none detected)</span>
          )}
        </div>
      </div>

      {/* Range Tracker - Daily (00:00 UTC) */}
      {range24h.max && range24h.min && (
        <div className="range-tracker">
          <span className="range-label">📊 Range Daily:</span>
          <span className="range-max">MAX ${formatSmartPrice(range24h.max, tickSize)}</span>
          <span className="range-separator">—</span>
          <span className="range-min">MIN ${formatSmartPrice(range24h.min, tickSize)}</span>
        </div>
      )}

      {/* Footer stats */}
      <div className="orderbook-footer">
        <div className="footer-stat">
          <span className="label">Bid Vol:</span>
          <span className="value bid-price">{formatSize(totalBidVolume)}</span>
        </div>
        <div className="footer-stat">
          <span className="label">Ask Vol:</span>
          <span className="value ask-price">{formatSize(totalAskVolume)}</span>
        </div>
      </div>

      {/* Coin Selector Modal */}
      {showCoinSelector && (
        <div className="coin-selector-overlay" onClick={handleCloseCoinSelector}>
          <div className="coin-selector-modal" onClick={(e) => e.stopPropagation()}>
            <div className="coin-selector-header">
              <h4>Select Coin ({availableCoins.length} available)</h4>
              <button onClick={handleCloseCoinSelector} className="close-btn">✕</button>
            </div>

            {/* Search Input */}
            <div className="coin-search-container">
              <input
                type="text"
                className="coin-search-input"
                placeholder="🔍 Search coin (e.g. BTC, ETH, SOL)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              {searchQuery && (
                <button
                  className="coin-search-clear"
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {loadingCoins ? (
              <div className="coin-selector-loading">Loading coins...</div>
            ) : (
              <div className="coin-selector-list">
                <div className="coin-selector-row header">
                  <div
                    className="sortable-header"
                    onClick={() => handleSortClick('symbol')}
                    title="Sort by symbol"
                  >
                    Symbol {sortField === 'symbol' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </div>
                  <div
                    className="sortable-header"
                    onClick={() => handleSortClick('volume24h')}
                    title="Sort by volume"
                  >
                    Volume 24h {sortField === 'volume24h' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </div>
                  <div
                    className="sortable-header"
                    onClick={() => handleSortClick('change24h')}
                    title="Sort by 24h change"
                  >
                    24h Gain {sortField === 'change24h' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </div>
                </div>
                {getSortedCoins().length === 0 ? (
                  <div className="coin-selector-no-results">
                    {searchQuery ? (
                      <>
                        <p>No coins found for "{searchQuery}"</p>
                        <button onClick={() => setSearchQuery('')} className="clear-search-btn">
                          Clear search
                        </button>
                      </>
                    ) : (
                      <p>No coins available</p>
                    )}
                  </div>
                ) : (
                  getSortedCoins().map((coin) => (
                    <div
                      key={coin.symbol}
                      className={`coin-selector-row ${coin.symbol === symbol ? 'active' : ''}`}
                      onClick={() => handleCoinSelect(coin.symbol)}
                    >
                      <div className="coin-symbol">{coin.symbol.replace('USDT', '')}</div>
                      <div className="coin-volume">
                        ${(coin.volume24h / 1000000).toFixed(2)}M
                      </div>
                      <div className={`coin-change ${coin.change24h >= 0 ? 'positive' : 'negative'}`}>
                        {coin.change24h >= 0 ? '+' : ''}{coin.change24h.toFixed(2)}%
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
