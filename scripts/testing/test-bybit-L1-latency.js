#!/usr/bin/env node
/**
 * BullBook - Bybit L1 OrderBook Latency Test
 *
 * Tests L1 (best bid/ask) with 10ms push frequency
 * Measures actual latency and update frequency
 *
 * Usage:
 *   node scripts/testing/test-bybit-L1-latency.js [SYMBOL]
 *
 * Examples:
 *   node scripts/testing/test-bybit-L1-latency.js                # Default: BTCUSDT
 *   node scripts/testing/test-bybit-L1-latency.js ETHUSDT        # ETH
 */

const WebSocket = require('ws');

// Colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bright: '\x1b[1m',
};

// Configuration
const SYMBOL = process.argv[2] || 'BTCUSDT';
const DEPTH = 1; // L1 only
const WS_URL = 'wss://stream.bybit.com/v5/public/linear';
const TEST_DURATION = 60000; // 60 seconds

// Statistics
const stats = {
  connected: false,
  connectionTime: null,
  firstMessageTime: null,
  lastMessageTime: null,
  messageCount: 0,
  deltaCount: 0,
  snapshotCount: 0,
  intervals: [], // Time between updates (ms)
  latencies: [], // Bybit timestamp vs receive time
  errors: [],
};

// OrderBook state
let bestBid = null;
let bestAsk = null;
let spread = null;

// Helpers
function log(level, message) {
  const timestamp = new Date().toISOString().substr(11, 12);
  const colorMap = {
    INFO: colors.blue,
    SUCCESS: colors.green,
    WARN: colors.yellow,
    ERROR: colors.red,
    DATA: colors.cyan,
  };
  const color = colorMap[level] || colors.reset;
  console.log(`${timestamp} ${color}[${level}]${colors.reset} ${message}`);
}

function formatNumber(num, decimals = 2) {
  return parseFloat(num).toFixed(decimals);
}

function calculateStats(arr) {
  if (arr.length === 0) return { min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };

  const sorted = [...arr].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
  const p50 = sorted[Math.floor(sorted.length * 0.50)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];

  return { min, max, avg, p50, p95, p99 };
}

// Display real-time quote
function displayQuote() {
  if (!bestBid || !bestAsk) return;

  const bidPrice = parseFloat(bestBid.price);
  const askPrice = parseFloat(bestAsk.price);
  const spreadValue = askPrice - bidPrice;
  const spreadPercent = (spreadValue / bidPrice) * 100;

  // Calculate update frequency
  let updateFreq = 'N/A';
  if (stats.intervals.length > 0) {
    const recentIntervals = stats.intervals.slice(-10);
    const avgInterval = recentIntervals.reduce((a, b) => a + b, 0) / recentIntervals.length;
    updateFreq = `~${formatNumber(avgInterval, 1)}ms`;
  }

  console.clear();
  console.log(`${colors.bright}${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}  BullBook L1 Latency Test - ${SYMBOL}${colors.reset}`);
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

  // Best Ask (Sell)
  console.log(`  ${colors.red}ASK${colors.reset}  ${colors.bright}${formatNumber(askPrice, 2).padStart(12)}${colors.reset}  │  ${formatNumber(bestAsk.qty, 4).padStart(10)}`);

  // Spread
  const spreadColor = spreadPercent < 0.01 ? colors.green : spreadPercent < 0.05 ? colors.yellow : colors.red;
  console.log(`       ${spreadColor}Spread: ${formatNumber(spreadValue, 2)} (${formatNumber(spreadPercent, 4)}%)${colors.reset}`);

  // Best Bid (Buy)
  console.log(`  ${colors.green}BID${colors.reset}  ${colors.bright}${formatNumber(bidPrice, 2).padStart(12)}${colors.reset}  │  ${formatNumber(bestBid.qty, 4).padStart(10)}`);

  console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);

  // Statistics
  const elapsed = ((Date.now() - stats.connectionTime) / 1000).toFixed(1);
  console.log(`  Updates: ${stats.deltaCount} | Snapshots: ${stats.snapshotCount} | Elapsed: ${elapsed}s`);
  console.log(`  Update Frequency: ${updateFreq} | Target: 10ms (L1)`);

  // Latency stats
  if (stats.latencies.length > 10) {
    const latencyStats = calculateStats(stats.latencies);
    console.log(`  Latency: min=${formatNumber(latencyStats.min)}ms avg=${formatNumber(latencyStats.avg)}ms max=${formatNumber(latencyStats.max)}ms`);
    console.log(`  Latency p50=${formatNumber(latencyStats.p50)}ms p95=${formatNumber(latencyStats.p95)}ms p99=${formatNumber(latencyStats.p99)}ms`);
  }

  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
  console.log(`  Press Ctrl+C to stop and see final statistics\n`);
}

// WebSocket connection
log('INFO', `Connecting to Bybit WebSocket (${SYMBOL}, L1)`);
log('INFO', `Target push frequency: 10ms (100 updates/second)`);
log('INFO', `Test duration: ${TEST_DURATION / 1000}s\n`);

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  stats.connected = true;
  stats.connectionTime = Date.now();
  log('SUCCESS', 'WebSocket connected');

  // Subscribe to L1 orderbook
  const subscribeMsg = {
    op: 'subscribe',
    args: [`orderbook.${DEPTH}.${SYMBOL}`],
  };

  ws.send(JSON.stringify(subscribeMsg));
  log('INFO', `Subscribing to orderbook.${DEPTH}.${SYMBOL}`);
});

ws.on('message', (data) => {
  try {
    const now = Date.now();
    const message = JSON.parse(data);
    stats.messageCount++;

    if (!stats.firstMessageTime) {
      stats.firstMessageTime = now;
    }

    // Calculate interval since last message
    if (stats.lastMessageTime) {
      const interval = now - stats.lastMessageTime;
      stats.intervals.push(interval);

      // Keep only last 1000 intervals
      if (stats.intervals.length > 1000) {
        stats.intervals.shift();
      }
    }

    stats.lastMessageTime = now;

    // Handle subscription response
    if (message.op === 'subscribe') {
      if (message.success) {
        log('SUCCESS', 'Subscribed to orderbook');
      } else {
        log('ERROR', `Subscription failed: ${message.ret_msg}`);
        stats.errors.push('Subscription failed');
      }
      return;
    }

    // Handle orderbook data
    if (message.topic && message.topic.startsWith('orderbook')) {
      const { type, data, ts } = message;

      // Calculate latency (Bybit timestamp vs receive time)
      if (ts) {
        const latency = now - ts;
        stats.latencies.push(latency);

        // Keep only last 1000 latencies
        if (stats.latencies.length > 1000) {
          stats.latencies.shift();
        }
      }

      if (type === 'snapshot') {
        stats.snapshotCount++;

        // L1 snapshot
        if (data.b && data.b.length > 0) {
          bestBid = { price: data.b[0][0], qty: data.b[0][1] };
        }
        if (data.a && data.a.length > 0) {
          bestAsk = { price: data.a[0][0], qty: data.a[0][1] };
        }

        displayQuote();
      } else if (type === 'delta') {
        stats.deltaCount++;

        // L1 delta - update best bid/ask
        if (data.b && data.b.length > 0) {
          const [price, qty] = data.b[0];
          if (parseFloat(qty) === 0) {
            // Best bid removed (rare in L1)
            bestBid = null;
          } else {
            bestBid = { price, qty };
          }
        }

        if (data.a && data.a.length > 0) {
          const [price, qty] = data.a[0];
          if (parseFloat(qty) === 0) {
            // Best ask removed (rare in L1)
            bestAsk = null;
          } else {
            bestAsk = { price, qty };
          }
        }

        displayQuote();
      }
    }
  } catch (error) {
    log('ERROR', `Parse error: ${error.message}`);
    stats.errors.push(`Parse error: ${error.message}`);
  }
});

ws.on('error', (error) => {
  log('ERROR', `WebSocket error: ${error.message}`);
  stats.errors.push(`WebSocket error: ${error.message}`);
});

ws.on('close', () => {
  log('WARN', 'WebSocket connection closed');
  printFinalStats();
  process.exit(0);
});

// Print final statistics
function printFinalStats() {
  console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.cyan}  FINAL STATISTICS - ${SYMBOL} L1${colors.reset}`);
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

  const elapsed = ((stats.lastMessageTime - stats.connectionTime) / 1000).toFixed(2);

  console.log(`  Total Duration:     ${elapsed}s`);
  console.log(`  Total Messages:     ${stats.messageCount}`);
  console.log(`  Snapshots:          ${stats.snapshotCount}`);
  console.log(`  Deltas:             ${stats.deltaCount}`);
  console.log(`  Messages/second:    ${formatNumber(stats.messageCount / elapsed, 1)}`);

  // Update intervals
  if (stats.intervals.length > 0) {
    const intervalStats = calculateStats(stats.intervals);
    console.log(`\n  ${colors.bright}Update Intervals:${colors.reset}`);
    console.log(`    Min:  ${formatNumber(intervalStats.min, 2)}ms`);
    console.log(`    Avg:  ${formatNumber(intervalStats.avg, 2)}ms`);
    console.log(`    Max:  ${formatNumber(intervalStats.max, 2)}ms`);
    console.log(`    P50:  ${formatNumber(intervalStats.p50, 2)}ms (median)`);
    console.log(`    P95:  ${formatNumber(intervalStats.p95, 2)}ms`);
    console.log(`    P99:  ${formatNumber(intervalStats.p99, 2)}ms`);

    const targetFreq = 10; // L1 target: 10ms
    const performance = (targetFreq / intervalStats.avg) * 100;
    const performanceColor = performance >= 80 ? colors.green : performance >= 50 ? colors.yellow : colors.red;
    console.log(`    ${performanceColor}Performance vs 10ms target: ${formatNumber(performance, 1)}%${colors.reset}`);
  }

  // Latencies
  if (stats.latencies.length > 0) {
    const latencyStats = calculateStats(stats.latencies);
    console.log(`\n  ${colors.bright}Network Latency (Bybit timestamp → Receive):${colors.reset}`);
    console.log(`    Min:  ${formatNumber(latencyStats.min, 2)}ms`);
    console.log(`    Avg:  ${formatNumber(latencyStats.avg, 2)}ms`);
    console.log(`    Max:  ${formatNumber(latencyStats.max, 2)}ms`);
    console.log(`    P50:  ${formatNumber(latencyStats.p50, 2)}ms (median)`);
    console.log(`    P95:  ${formatNumber(latencyStats.p95, 2)}ms`);
    console.log(`    P99:  ${formatNumber(latencyStats.p99, 2)}ms`);
  }

  // Errors
  if (stats.errors.length > 0) {
    console.log(`\n  ${colors.red}Errors: ${stats.errors.length}${colors.reset}`);
    stats.errors.slice(0, 5).forEach((err) => {
      console.log(`    - ${err}`);
    });
  }

  console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
}

// Handle Ctrl+C
process.on('SIGINT', () => {
  log('INFO', 'Stopping test...');
  ws.close(1000, 'User interrupted');
});

// Auto-stop after test duration
setTimeout(() => {
  log('INFO', `Test duration ${TEST_DURATION / 1000}s reached, stopping...`);
  ws.close(1000, 'Test duration reached');
}, TEST_DURATION);
