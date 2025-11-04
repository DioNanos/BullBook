#!/usr/bin/env node
/**
 * BullBook - Bybit OrderBook WebSocket Test
 *
 * Tests connection to Bybit WebSocket API v5 and validates orderbook data
 *
 * Usage:
 *   node scripts/testing/test-bybit-orderbook.js [SYMBOL] [DEPTH]
 *
 * Examples:
 *   node scripts/testing/test-bybit-orderbook.js                    # Default: BTCUSDT, depth 50
 *   node scripts/testing/test-bybit-orderbook.js ETHUSDT 200        # ETH with depth 200
 */

const WebSocket = require('ws');

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Configuration
const SYMBOL = process.argv[2] || 'BTCUSDT';
const DEPTH = parseInt(process.argv[3]) || 50;
const WS_URL = 'wss://stream.bybit.com/v5/public/linear';

// Valid depths for linear/spot
const VALID_DEPTHS = [1, 50, 200, 500];
if (!VALID_DEPTHS.includes(DEPTH)) {
  console.error(`${colors.red}[ERROR]${colors.reset} Invalid depth: ${DEPTH}`);
  console.error(`Valid depths: ${VALID_DEPTHS.join(', ')}`);
  process.exit(1);
}

// Statistics
const stats = {
  connected: false,
  subscribed: false,
  snapshotReceived: false,
  deltaCount: 0,
  messageCount: 0,
  startTime: Date.now(),
  lastMessageTime: null,
  errors: [],
};

// Orderbook state
let orderbook = {
  bids: new Map(), // price -> quantity
  asks: new Map(),
  updateId: 0,
  sequence: 0,
  timestamp: null,
};

// Helper functions
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

function formatPrice(price) {
  return parseFloat(price).toFixed(2);
}

function formatQuantity(qty) {
  return parseFloat(qty).toFixed(4);
}

function updateOrderbook(side, levels) {
  const book = side === 'bid' ? orderbook.bids : orderbook.asks;

  for (const [price, quantity] of levels) {
    const qty = parseFloat(quantity);

    if (qty === 0) {
      // Remove level
      book.delete(price);
    } else {
      // Add or update level
      book.set(price, qty);
    }
  }
}

function sortOrderbook(side) {
  const book = side === 'bid' ? orderbook.bids : orderbook.asks;
  const sorted = [...book.entries()].sort((a, b) => {
    const priceA = parseFloat(a[0]);
    const priceB = parseFloat(b[0]);
    return side === 'bid' ? priceB - priceA : priceA - priceB;
  });
  return sorted;
}

function displayOrderbook(topN = 5) {
  const bids = sortOrderbook('bid').slice(0, topN);
  const asks = sortOrderbook('ask').slice(0, topN);

  console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.cyan}  ${SYMBOL} OrderBook (Top ${topN} levels)${colors.reset}`);
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);

  // Asks (reversed, highest first)
  console.log(`\n${colors.red}  ASKS (Sell Orders)${colors.reset}`);
  asks.reverse().forEach(([price, qty]) => {
    console.log(`  ${colors.red}${formatPrice(price)}${colors.reset}  │  ${formatQuantity(qty)}`);
  });

  // Spread
  if (bids.length > 0 && asks.length > 0) {
    const bestBid = parseFloat(bids[0][0]);
    const bestAsk = parseFloat(asks[0][0]);
    const spread = bestAsk - bestBid;
    const spreadPercent = ((spread / bestBid) * 100).toFixed(4);

    console.log(`\n  ${colors.yellow}────────────────────────────────────────────${colors.reset}`);
    console.log(`  ${colors.yellow}Spread: ${spread.toFixed(2)} (${spreadPercent}%)${colors.reset}`);
    console.log(`  ${colors.yellow}────────────────────────────────────────────${colors.reset}\n`);
  }

  // Bids
  console.log(`${colors.green}  BIDS (Buy Orders)${colors.reset}`);
  bids.forEach(([price, qty]) => {
    console.log(`  ${colors.green}${formatPrice(price)}${colors.reset}  │  ${formatQuantity(qty)}`);
  });

  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
}

function displayStats() {
  const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(1);
  const avgLatency = stats.lastMessageTime
    ? ((Date.now() - stats.lastMessageTime) / 1000).toFixed(3)
    : 'N/A';

  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.blue}  Statistics${colors.reset}`);
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`  Connected:        ${stats.connected ? colors.green + 'YES' : colors.red + 'NO'}${colors.reset}`);
  console.log(`  Subscribed:       ${stats.subscribed ? colors.green + 'YES' : colors.red + 'NO'}${colors.reset}`);
  console.log(`  Snapshot received: ${stats.snapshotReceived ? colors.green + 'YES' : colors.red + 'NO'}${colors.reset}`);
  console.log(`  Messages received: ${stats.messageCount}`);
  console.log(`  Delta updates:    ${stats.deltaCount}`);
  console.log(`  Bid levels:       ${orderbook.bids.size}`);
  console.log(`  Ask levels:       ${orderbook.asks.size}`);
  console.log(`  Update ID:        ${orderbook.updateId}`);
  console.log(`  Elapsed time:     ${elapsed}s`);
  console.log(`  Avg latency:      ${avgLatency}s`);

  if (stats.errors.length > 0) {
    console.log(`\n  ${colors.red}Errors: ${stats.errors.length}${colors.reset}`);
    stats.errors.slice(-3).forEach((err) => {
      console.log(`    - ${err}`);
    });
  }

  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
}

// Main WebSocket connection
log('INFO', `Starting Bybit OrderBook WebSocket test`);
log('INFO', `Symbol: ${SYMBOL}, Depth: ${DEPTH}`);
log('INFO', `Connecting to: ${WS_URL}`);
log('INFO', `Press Ctrl+C to stop\n`);

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  stats.connected = true;
  log('SUCCESS', 'WebSocket connected');

  // Subscribe to orderbook
  const subscribeMsg = {
    op: 'subscribe',
    args: [`orderbook.${DEPTH}.${SYMBOL}`],
  };

  log('INFO', `Subscribing to orderbook.${DEPTH}.${SYMBOL}`);
  ws.send(JSON.stringify(subscribeMsg));
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data);
    stats.messageCount++;
    stats.lastMessageTime = Date.now();

    // Handle subscription confirmation
    if (message.op === 'subscribe') {
      if (message.success) {
        stats.subscribed = true;
        log('SUCCESS', `Subscribed to ${message.req_id || 'orderbook'}`);
      } else {
        log('ERROR', `Subscription failed: ${message.ret_msg}`);
        stats.errors.push(`Subscription failed: ${message.ret_msg}`);
      }
      return;
    }

    // Handle orderbook data
    if (message.topic && message.topic.startsWith('orderbook')) {
      const { type, data, ts, cts } = message;

      if (type === 'snapshot') {
        stats.snapshotReceived = true;
        log('DATA', `Snapshot received - Update ID: ${data.u}, Seq: ${data.seq}`);

        // Initialize orderbook with snapshot
        orderbook.bids.clear();
        orderbook.asks.clear();
        orderbook.updateId = data.u;
        orderbook.sequence = data.seq;
        orderbook.timestamp = ts;

        updateOrderbook('bid', data.b || []);
        updateOrderbook('ask', data.a || []);

        log('INFO', `Initialized: ${orderbook.bids.size} bids, ${orderbook.asks.size} asks`);

        // Display orderbook after snapshot
        displayOrderbook(10);
      } else if (type === 'delta') {
        stats.deltaCount++;

        // Apply delta updates
        if (data.b && data.b.length > 0) {
          updateOrderbook('bid', data.b);
        }
        if (data.a && data.a.length > 0) {
          updateOrderbook('ask', data.a);
        }

        orderbook.updateId = data.u;
        orderbook.sequence = data.seq;
        orderbook.timestamp = ts;

        // Log delta (quiet, only every 10th)
        if (stats.deltaCount % 10 === 0) {
          log('DATA', `Delta #${stats.deltaCount} - Update ID: ${data.u}`);
        }
      }
    }
  } catch (error) {
    log('ERROR', `Failed to parse message: ${error.message}`);
    stats.errors.push(`Parse error: ${error.message}`);
  }
});

ws.on('error', (error) => {
  log('ERROR', `WebSocket error: ${error.message}`);
  stats.errors.push(`WebSocket error: ${error.message}`);
});

ws.on('close', (code, reason) => {
  stats.connected = false;
  log('WARN', `WebSocket closed - Code: ${code}, Reason: ${reason || 'N/A'}`);
  displayStats();
  process.exit(code === 1000 ? 0 : 1);
});

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  log('INFO', '\nShutting down gracefully...');
  displayOrderbook(10);
  displayStats();

  ws.close(1000, 'User interrupted');
  setTimeout(() => process.exit(0), 1000);
});

// Display stats every 10 seconds
setInterval(() => {
  if (stats.snapshotReceived) {
    displayOrderbook(5);
    displayStats();
  }
}, 10000);
