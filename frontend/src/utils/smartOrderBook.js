/**
 * Smart OrderBook Utilities
 * Calcola tick size intelligente, big levels, e range tracking
 */

/**
 * Calculate suggested tick size based on volatility and price
 * Target: 0.3-0.5% per minute volatility for scalping
 *
 * @param {number} price - Current price
 * @param {number} volatilityPerMin - Volatility % per minute
 * @returns {number} - Suggested tick size
 */
export function calculateSmartTickSize(price, volatilityPerMin) {
  if (!price || !volatilityPerMin) return null

  // Base formula: price * (volatility / 50)
  // This creates ~30-50 meaningful levels for typical volatility
  const rawTick = price * (volatilityPerMin / 50)

  // Round to nice numbers
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawTick)))

  // Round to 1, 2, 5, 10, 20, 50, 100, etc.
  const niceNumbers = [1, 2, 5, 10, 20, 50, 100]
  const normalized = rawTick / magnitude

  let closestNice = niceNumbers[0]
  let minDiff = Math.abs(normalized - closestNice)

  for (const nice of niceNumbers) {
    const diff = Math.abs(normalized - nice)
    if (diff < minDiff) {
      minDiff = diff
      closestNice = nice
    }
  }

  const suggestedTick = closestNice * magnitude

  // Apply min/max bounds
  const minTick = 0.00000001
  const maxTick = price * 0.01 // Max 1% of price

  return Math.max(minTick, Math.min(maxTick, suggestedTick))
}

/**
 * Find the biggest level (wall) in orderbook
 * Only returns level if it's at least 10x the average size
 *
 * @param {Array} levels - Array of [price, size]
 * @returns {Object|null} - { price, size, index } or null if not significant
 */
export function findBiggestLevel(levels) {
  if (!levels || levels.length === 0) return null

  // Calculate average size of all levels
  const totalSize = levels.reduce((sum, [_, size]) => sum + parseFloat(size), 0)
  const avgSize = totalSize / levels.length

  // Find biggest level
  let maxSize = 0
  let maxIndex = 0

  levels.forEach(([price, size], index) => {
    const sizeNum = parseFloat(size)
    if (sizeNum > maxSize) {
      maxSize = sizeNum
      maxIndex = index
    }
  })

  // Filter: must be at least 10x average to be considered significant
  if (maxSize < avgSize * 10) {
    return null
  }

  const [price, size] = levels[maxIndex]

  return {
    price: parseFloat(price),
    size: parseFloat(size),
    index: maxIndex
  }
}

/**
 * Calculate percentage distance from current price
 *
 * @param {number} targetPrice - Target price level
 * @param {number} currentPrice - Current price
 * @returns {number} - Percentage (positive = above, negative = below)
 */
export function calculatePercentDistance(targetPrice, currentPrice) {
  if (!targetPrice || !currentPrice) return 0
  return ((targetPrice - currentPrice) / currentPrice) * 100
}

/**
 * Format price with dynamic decimals
 */
export function formatSmartPrice(price, tickSize) {
  if (!price) return '0'

  const decimals = tickSize >= 1 ? 0 :
                   tickSize >= 0.1 ? 1 :
                   tickSize >= 0.01 ? 2 :
                   tickSize >= 0.001 ? 3 :
                   tickSize >= 0.0001 ? 4 :
                   tickSize >= 0.00001 ? 5 :
                   tickSize >= 0.000001 ? 6 :
                   tickSize >= 0.0000001 ? 7 : 8

  return price.toFixed(decimals)
}

/**
 * Format large size numbers (1.5K, 2.3M, etc.)
 */
export function formatBigSize(size) {
  if (size >= 1000000) return `${(size / 1000000).toFixed(2)}M`
  if (size >= 1000) return `${(size / 1000).toFixed(1)}K`
  return size.toFixed(2)
}

/**
 * Detect big walls in orderbook with multiple criteria
 * Returns array of big walls with classification (huge, big, medium)
 *
 * Detection Criteria:
 * 1. Volume >10x average of all levels
 * 2. Value USDT >100K (size * price > 100000)
 * 3. Volume >5x adjacent level (spike detection)
 *
 * @param {Array} levels - Array of [price, size]
 * @param {number} currentPrice - Current market price for distance calculation
 * @returns {Array} - Array of { price, size, valueUSDT, distancePercent, type, index }
 */
export function detectBigWalls(levels, currentPrice) {
  if (!levels || levels.length === 0 || !currentPrice) return []

  const bigWalls = []

  // Calculate average size of all levels
  const totalSize = levels.reduce((sum, [_, size]) => sum + parseFloat(size), 0)
  const avgSize = totalSize / levels.length

  levels.forEach(([price, size], index) => {
    const priceNum = parseFloat(price)
    const sizeNum = parseFloat(size)
    const valueUSDT = priceNum * sizeNum

    // Calculate distance from current price
    const distancePercent = ((priceNum - currentPrice) / currentPrice) * 100

    // Get adjacent level size for spike detection
    let adjacentSize = avgSize // Default to average if no adjacent
    if (index > 0) {
      adjacentSize = parseFloat(levels[index - 1][1])
    } else if (index < levels.length - 1) {
      adjacentSize = parseFloat(levels[index + 1][1])
    }

    // Criteria checks
    const is10xAverage = sizeNum >= avgSize * 10
    const isOver100K = valueUSDT >= 100000
    const is5xAdjacent = sizeNum >= adjacentSize * 5

    // Classification
    let type = null
    if (is10xAverage && isOver100K && is5xAdjacent) {
      type = 'huge' // All 3 criteria met
    } else if ((is10xAverage && isOver100K) || (is10xAverage && is5xAdjacent) || (isOver100K && is5xAdjacent)) {
      type = 'big' // Any 2 criteria met
    } else if (is10xAverage || isOver100K || is5xAdjacent) {
      type = 'medium' // Any 1 criterion met
    }

    // Add to big walls if at least one criterion met
    if (type) {
      bigWalls.push({
        price: priceNum,
        size: sizeNum,
        valueUSDT,
        distancePercent,
        type,
        index
      })
    }
  })

  return bigWalls
}
