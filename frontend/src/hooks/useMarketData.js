import { useState, useEffect, useRef } from 'react'

/**
 * Custom hook for market data: 5m candles, volatility, 24h range tracking
 * Fetches from Bybit API and calculates smart indicators
 */
export function useMarketData(symbol) {
  const [candles, setCandles] = useState([])
  const [volatility, setVolatility] = useState(null) // % per minute
  const [range24h, setRange24h] = useState({ max: null, min: null })
  const [isLoading, setIsLoading] = useState(true)
  const fetchIntervalRef = useRef(null)

  // Fetch 5m candles from Bybit
  const fetchCandles = async () => {
    try {
      // Fetch last 20 candles (5m * 20 = 100 minutes of data)
      const response = await fetch(
        `https://api.bybit.com/v5/market/kline?category=linear&symbol=${symbol}&interval=5&limit=20`
      )
      const data = await response.json()

      if (data.retCode === 0 && data.result?.list) {
        // Bybit returns: [timestamp, open, high, low, close, volume, turnover]
        const candleData = data.result.list.map(candle => ({
          timestamp: parseInt(candle[0]),
          open: parseFloat(candle[1]),
          high: parseFloat(candle[2]),
          low: parseFloat(candle[3]),
          close: parseFloat(candle[4]),
          volume: parseFloat(candle[5])
        }))

        // Sort by timestamp ascending (oldest first)
        candleData.sort((a, b) => a.timestamp - b.timestamp)

        setCandles(candleData)
        calculateVolatility(candleData)
        setIsLoading(false)
      }
    } catch (error) {
      console.error('[useMarketData] Failed to fetch candles:', error)
      setIsLoading(false)
    }
  }

  // Calculate volatility from recent candles
  const calculateVolatility = (candleData) => {
    if (candleData.length === 0) return

    // Use last 3 candles (15 minutes) for volatility calculation
    const recentCandles = candleData.slice(-3)

    // Calculate average volatility % per candle (5 minutes)
    const volatilities = recentCandles.map(candle => {
      const range = candle.high - candle.low
      const volatilityPct = (range / candle.open) * 100
      return volatilityPct
    })

    // Average volatility per 5min, then scale to per minute
    const avgVolatility5m = volatilities.reduce((sum, v) => sum + v, 0) / volatilities.length
    const volatilityPerMinute = avgVolatility5m / 5

    setVolatility(volatilityPerMinute)
  }

  // Fetch daily range (MAX/MIN from 00:00 UTC today)
  const fetchRangeDaily = async () => {
    try {
      // Calculate timestamp for 00:00 UTC today
      const now = new Date()
      const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0))
      const startTimestamp = todayUTC.getTime()

      // Fetch 1h candles from 00:00 UTC today (max 24 candles for full day)
      const response = await fetch(
        `https://api.bybit.com/v5/market/kline?category=linear&symbol=${symbol}&interval=60&start=${startTimestamp}&limit=50`
      )
      const data = await response.json()

      if (data.retCode === 0 && data.result?.list) {
        // Extract high/low from all candles since 00:00 UTC
        const highs = data.result.list.map(candle => parseFloat(candle[2]))
        const lows = data.result.list.map(candle => parseFloat(candle[3]))

        const max = Math.max(...highs)
        const min = Math.min(...lows)

        setRange24h({ max, min })
      }
    } catch (error) {
      console.error('[useMarketData] Failed to fetch daily range:', error)
    }
  }

  // Fetch on mount and every 30 seconds
  useEffect(() => {
    if (!symbol) return

    fetchCandles()
    fetchRangeDaily()

    // Refetch every 30 seconds to keep data fresh
    fetchIntervalRef.current = setInterval(() => {
      fetchCandles()
      fetchRangeDaily()
    }, 30000) // 30 seconds

    return () => {
      if (fetchIntervalRef.current) {
        clearInterval(fetchIntervalRef.current)
      }
    }
  }, [symbol])

  return {
    candles,
    volatility, // % per minute
    range24h, // { max, min } - Daily range from 00:00 UTC
    isLoading
  }
}
