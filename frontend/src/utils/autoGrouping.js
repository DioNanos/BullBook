/**
 * Auto-Grouping Utilities
 *
 * Calculates optimal tick size and selects fastest data source
 * for orderbook display optimized for scalping.
 */

/**
 * Source depths (number of raw levels from Bybit API)
 */
const SOURCE_DEPTHS = {
  L50: 50,      // 50 raw levels (fastest, 20ms)
  L200: 200,    // 200 raw levels (medium, 100ms)
  L1000: 1000   // 1000 raw levels (slowest, 300ms)
};

/**
 * Source latencies (push frequency in ms)
 */
const SOURCE_LATENCIES = {
  L50: 20,
  L200: 100,
  L1000: 300
};

/**
 * Human-readable tick sizes for rounding
 */
const HUMAN_TICKS = [
  0.00000001, // Pico
  0.0000001,  // Nano
  0.000001,   // Micro
  0.00001,    // Very low
  0.0001,     // Low
  0.001,      // Medium-low
  0.01,       // Medium
  0.1,        // Medium-high
  1,          // High
  10,         // Very high
  100,        // Extreme
  1000        // Max
];

/**
 * Calculate optimal tick size for scalping (10 levels within ±1%)
 *
 * @param {number} currentPrice - Current market price
 * @returns {number} Optimal tick size rounded to human-readable value
 */
export function calculateAutoTickSize(currentPrice) {
  if (!currentPrice || currentPrice <= 0) {
    return 0.01; // Default fallback
  }

  // Scalping range: ±1% of price
  const scalpingRange = currentPrice * 0.01;

  // Target: 10 levels per side
  const targetLevels = 10;

  // Calculate ideal tick
  const idealTick = scalpingRange / targetLevels;

  // Round to nearest human-readable tick
  const roundedTick = HUMAN_TICKS.reduce((prev, curr) =>
    Math.abs(curr - idealTick) < Math.abs(prev - idealTick) ? curr : prev
  );

  return roundedTick;
}

/**
 * Select fastest source based on tick size
 *
 * Strategy: Use heuristic based on tick size to ensure enough levels
 * - Micro ticks (< 0.001): L200 for shitcoins (sparse books need depth)
 * - Small ticks (0.001-0.1): L50 for fast mid-caps
 * - Medium ticks (0.1-10): L200 for coverage
 * - Large ticks (> 10): L1000 for deep book
 *
 * @param {number} tickSize - Tick size for grouping
 * @param {number} minLevels - Minimum levels required (default: 10)
 * @returns {object} Selected source info { source, depth, latency, estimatedLevels }
 */
export function selectSourceAutomatic(tickSize, minLevels = 10) {
  let source, depth, rawLevels;

  // Conservative heuristic: Guarantee minLevels with safety margin
  // Strategy: Prefer L200 (100ms) for balance speed/depth, use L50/L1000 only when needed

  if (tickSize < 0.01) {
    // Micro tick (shitcoins): L200 guaranteed
    // Very small tick + sparse books = need depth
    source = 'L200';
    depth = SOURCE_DEPTHS.L200;
    rawLevels = 100;
  } else if (tickSize < 0.5) {
    // Small-medium tick: L200 safe choice
    // Ensures 10+ levels even with moderate grouping
    source = 'L200';
    depth = SOURCE_DEPTHS.L200;
    rawLevels = 100;
  } else if (tickSize < 5) {
    // Medium tick: L200 still safe
    // Balance between latency and levels
    source = 'L200';
    depth = SOURCE_DEPTHS.L200;
    rawLevels = 100;
  } else if (tickSize < 50) {
    // Large tick: L1000 for deep grouping
    // Heavy grouping reduces levels significantly
    source = 'L1000';
    depth = SOURCE_DEPTHS.L1000;
    rawLevels = 200;
  } else {
    // Very large tick (BTC 100+): L1000 required
    // Extreme grouping needs maximum depth
    source = 'L1000';
    depth = SOURCE_DEPTHS.L1000;
    rawLevels = 200;
  }

  return {
    source,
    depth,
    latency: SOURCE_LATENCIES[source],
    estimatedLevels: rawLevels,
    warning: rawLevels < minLevels ? `Only ~${rawLevels} levels expected` : null
  };
}

/**
 * Calculate adaptive tick size that ensures minLevels are available
 *
 * @param {number} currentPrice - Current market price
 * @param {number} minLevels - Minimum levels required (default: 10)
 * @returns {object} { tickSize, source, depth, latency, levels }
 */
export function calculateAdaptiveTickSize(currentPrice, minLevels = 10) {
  // Start with ideal tick for scalping
  let tickSize = calculateAutoTickSize(currentPrice);

  // Try to find source with enough levels
  let result = selectSourceAutomatic(tickSize, minLevels);

  // If insufficient, reduce tick size (more granular) until we have enough levels
  let attempts = 0;
  const maxAttempts = HUMAN_TICKS.length;

  while (result.estimatedLevels < minLevels && attempts < maxAttempts) {
    const tickIndex = HUMAN_TICKS.indexOf(tickSize);

    // Can't go smaller
    if (tickIndex === 0) break;

    // Try smaller tick
    tickSize = HUMAN_TICKS[tickIndex - 1];
    result = selectSourceAutomatic(tickSize, minLevels);
    attempts++;
  }

  return {
    tickSize,
    ...result
  };
}

/**
 * Group orderbook levels by tick size
 *
 * @param {Array} levels - Array of [price, size] tuples
 * @param {number} tickSize - Tick size for grouping
 * @param {string} sortDirection - 'asc' or 'desc'
 * @param {number} maxLevels - Maximum levels to return
 * @returns {Array} Grouped levels [[price, size], ...]
 */
export function groupLevels(levels, tickSize, sortDirection = 'desc', maxLevels = 10) {
  if (!levels || levels.length === 0) {
    return [];
  }

  const buckets = new Map();

  // Group by tick size
  levels.forEach(([price, size]) => {
    const priceNum = parseFloat(price);
    const sizeNum = parseFloat(size);

    if (isNaN(priceNum) || isNaN(sizeNum)) return;

    // Calculate bucket price
    const bucketPrice = Math.floor(priceNum / tickSize) * tickSize;

    // Accumulate size in bucket
    const currentSize = buckets.get(bucketPrice) || 0;
    buckets.set(bucketPrice, currentSize + sizeNum);
  });

  // Convert to array and sort
  const grouped = Array.from(buckets.entries())
    .map(([price, size]) => [
      price.toFixed(getDecimals(tickSize)),
      size.toFixed(3)
    ])
    .sort((a, b) => {
      const priceA = parseFloat(a[0]);
      const priceB = parseFloat(b[0]);

      if (sortDirection === 'desc') {
        return priceB - priceA; // High to low (bids)
      }
      return priceA - priceB; // Low to high (asks)
    });

  // Limit to maxLevels
  return grouped.slice(0, maxLevels);
}

/**
 * Group complete orderbook (bids + asks)
 *
 * @param {object} orderBook - { bids: [[price, size]], asks: [[price, size]] }
 * @param {number} tickSize - Tick size for grouping
 * @param {number} maxLevels - Max levels per side
 * @returns {object} Grouped orderbook { bids, asks }
 */
export function groupOrderbook(orderBook, tickSize, maxLevels = 10) {
  if (!orderBook || !orderBook.bids || !orderBook.asks) {
    return { bids: [], asks: [] };
  }

  return {
    bids: groupLevels(orderBook.bids, tickSize, 'desc', maxLevels),
    asks: groupLevels(orderBook.asks, tickSize, 'asc', maxLevels),
    timestamp: orderBook.timestamp,
    updateId: orderBook.updateId
  };
}

/**
 * Get number of decimal places for a tick size
 *
 * @param {number} tickSize - Tick size
 * @returns {number} Number of decimal places
 */
function getDecimals(tickSize) {
  if (tickSize >= 1) return 0;
  if (tickSize >= 0.1) return 1;
  if (tickSize >= 0.01) return 2;
  if (tickSize >= 0.001) return 3;
  if (tickSize >= 0.0001) return 4;
  if (tickSize >= 0.00001) return 5;
  if (tickSize >= 0.000001) return 6;
  if (tickSize >= 0.0000001) return 7;
  return 8;
}

/**
 * Format source info for display
 *
 * @param {string} source - Source name ('L50', 'L200', 'L1000')
 * @returns {object} { icon, label, latency }
 */
export function formatSourceInfo(source) {
  const icons = {
    L50: '⚡⚡⚡',
    L200: '⚡⚡',
    L1000: '⚡'
  };

  return {
    icon: icons[source] || '⚡',
    label: source,
    latency: SOURCE_LATENCIES[source]
  };
}
