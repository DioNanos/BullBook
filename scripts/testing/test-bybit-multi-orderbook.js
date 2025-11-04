#!/usr/bin/env node
/**
 * BullBook - Bybit Multi OrderBook WebSocket Test
 *
 * Simulates 9 simultaneous orderbook connections (3x3 grid)
 * Tests performance and resource usage with multiple WebSocket connections
 *
 * Usage:
 *   node scripts/testing/test-bybit-multi-orderbook.js
 *
 * This simulates the actual BullBook grid with 9 orderbooks running simultaneously
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
};

// 9 symbols for grid (default BullBook configuration)
const SYMBOLS = [
  'BTCUSDT', // Position 0 (top-left)
  'ETHUSDT', // Position 1 (top-center)
  'SOLUSDT', // Position 2 (top-right)
  'BNBUSDT', // Position 3 (middle-left)
  'XRPUSDT', // Position 4 (middle-center)
  'ADAUSDT', // Position 5 (middle-right)
  'DOGEUSDT', // Position 6 (bottom-left)
  'AVAXUSDT', // Position 7 (bottom-center)
  'MATICUSDT', // Position 8 (bottom-right)
];

const DEPTH = 50;
const WS_URL = 'wss://stream.bybit.com/v5/public/linear';

// Global statistics
const globalStats = {
  connections: new Map(), // symbol -> connection stats
  totalMessages: 0,
  totalDeltas: 0,
  startTime: Date.now(),
  errors: [],
};

// Per-connection orderbook state
class OrderBookConnection {
  constructor(symbol, position) {
    this.symbol = symbol;
    this.position = position;
    this.ws = null;
    this.connected = false;
    this.subscribed = false;
    this.snapshotReceived = false;
    this.messageCount = 0;
    this.deltaCount = 0;
    this.lastUpdateTime = null;

    this.orderbook = {
      bids: new Map(),
      asks: new Map(),
      updateId: 0,
      sequence: 0,
    };
  }

  log(level, message) {
    const timestamp = new Date().toISOString().substr(11, 12);
    const colorMap = {
      INFO: colors.blue,
      SUCCESS: colors.green,
      WARN: colors.yellow,
      ERROR: colors.red,
    };
    const color = colorMap[level] || colors.reset;
    console.log(
      `${timestamp} ${color}[${level}]${colors.reset} [${this.symbol}@${this.position}] ${message}`
    );
  }

  connect() {
    this.ws = new WebSocket(WS_URL);

    this.ws.on('open', () => {
      this.connected = true;
      this.log('SUCCESS', 'Connected');

      // Subscribe to orderbook
      const subscribeMsg = {
        op: 'subscribe',
        args: [`orderbook.${DEPTH}.${this.symbol}`],
      };
      this.ws.send(JSON.stringify(subscribeMsg));
    });

    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        this.messageCount++;
        globalStats.totalMessages++;
        this.lastUpdateTime = Date.now();

        // Handle subscription
        if (message.op === 'subscribe') {
          if (message.success) {
            this.subscribed = true;
            this.log('SUCCESS', 'Subscribed');
          } else {
            this.log('ERROR', `Subscription failed: ${message.ret_msg}`);
            globalStats.errors.push(`${this.symbol}: Subscription failed`);
          }
          return;
        }

        // Handle orderbook data
        if (message.topic && message.topic.startsWith('orderbook')) {
          const { type, data } = message;

          if (type === 'snapshot') {
            this.snapshotReceived = true;
            this.orderbook.bids.clear();
            this.orderbook.asks.clear();

            // Update orderbook
            data.b?.forEach(([price, qty]) => {
              if (parseFloat(qty) > 0) {
                this.orderbook.bids.set(price, parseFloat(qty));
              }
            });
            data.a?.forEach(([price, qty]) => {
              if (parseFloat(qty) > 0) {
                this.orderbook.asks.set(price, parseFloat(qty));
              }
            });

            this.orderbook.updateId = data.u;
            this.orderbook.sequence = data.seq;
          } else if (type === 'delta') {
            this.deltaCount++;
            globalStats.totalDeltas++;

            // Apply deltas
            data.b?.forEach(([price, qty]) => {
              const qtyNum = parseFloat(qty);
              if (qtyNum === 0) {
                this.orderbook.bids.delete(price);
              } else {
                this.orderbook.bids.set(price, qtyNum);
              }
            });
            data.a?.forEach(([price, qty]) => {
              const qtyNum = parseFloat(qty);
              if (qtyNum === 0) {
                this.orderbook.asks.delete(price);
              } else {
                this.orderbook.asks.set(price, qtyNum);
              }
            });

            this.orderbook.updateId = data.u;
            this.orderbook.sequence = data.seq;
          }
        }
      } catch (error) {
        this.log('ERROR', `Parse error: ${error.message}`);
        globalStats.errors.push(`${this.symbol}: Parse error`);
      }
    });

    this.ws.on('error', (error) => {
      this.log('ERROR', `WebSocket error: ${error.message}`);
      globalStats.errors.push(`${this.symbol}: WebSocket error`);
    });

    this.ws.on('close', () => {
      this.connected = false;
      this.log('WARN', 'Connection closed');
    });
  }

  getStats() {
    return {
      symbol: this.symbol,
      position: this.position,
      connected: this.connected,
      subscribed: this.subscribed,
      snapshotReceived: this.snapshotReceived,
      messageCount: this.messageCount,
      deltaCount: this.deltaCount,
      bidLevels: this.orderbook.bids.size,
      askLevels: this.orderbook.asks.size,
      updateId: this.orderbook.updateId,
      lastUpdateTime: this.lastUpdateTime,
    };
  }

  disconnect() {
    if (this.ws) {
      this.ws.close(1000, 'User disconnected');
    }
  }
}

// Display grid status
function displayGrid() {
  console.clear();

  const elapsed = ((Date.now() - globalStats.startTime) / 1000).toFixed(1);

  console.log(`${colors.cyan}┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓${colors.reset}`);
  console.log(`${colors.cyan}┃  BullBook Multi-OrderBook Test - 3x3 Grid Simulation            ┃${colors.reset}`);
  console.log(`${colors.cyan}┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫${colors.reset}`);
  console.log(`${colors.cyan}┃  Elapsed: ${elapsed}s | Total Messages: ${globalStats.totalMessages} | Deltas: ${globalStats.totalDeltas}${' '.repeat(Math.max(0, 15 - globalStats.totalDeltas.toString().length))}┃${colors.reset}`);
  console.log(`${colors.cyan}┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛${colors.reset}\n`);

  // Display 3x3 grid
  for (let row = 0; row < 3; row++) {
    const rowConnections = [];
    for (let col = 0; col < 3; col++) {
      const position = row * 3 + col;
      const symbol = SYMBOLS[position];
      const conn = globalStats.connections.get(symbol);

      if (!conn) continue;

      const stats = conn.getStats();
      const statusColor = stats.connected && stats.snapshotReceived ? colors.green : colors.yellow;

      rowConnections.push({
        symbol: stats.symbol,
        statusColor,
        bidLevels: stats.bidLevels,
        askLevels: stats.askLevels,
        deltaCount: stats.deltaCount,
      });
    }

    // Display row
    console.log(`  ┌${'─'.repeat(20)}┬${'─'.repeat(20)}┬${'─'.repeat(20)}┐`);
    rowConnections.forEach((rc, idx) => {
      const separator = idx < 2 ? '│' : '│';
      console.log(
        `  │ ${rc.statusColor}${rc.symbol.padEnd(8)}${colors.reset} ${rc.bidLevels}B/${rc.askLevels}A ${separator}`
      );
    });
    console.log(`  │ ${rowConnections[0].statusColor}Δ${rowConnections[0].deltaCount}${colors.reset}`.padEnd(27) +
      `│ ${rowConnections[1].statusColor}Δ${rowConnections[1].deltaCount}${colors.reset}`.padEnd(27) +
      `│ ${rowConnections[2].statusColor}Δ${rowConnections[2].deltaCount}${colors.reset}`.padEnd(27) + '│');
    console.log(`  └${'─'.repeat(20)}┴${'─'.repeat(20)}┴${'─'.repeat(20)}┘`);
    if (row < 2) console.log();
  }

  // Summary
  const allConnected = [...globalStats.connections.values()].every(
    (c) => c.connected && c.snapshotReceived
  );
  const statusIcon = allConnected ? `${colors.green}✓${colors.reset}` : `${colors.yellow}⏳${colors.reset}`;

  console.log(`\n  ${statusIcon} Status: ${allConnected ? colors.green + 'All Connected' : colors.yellow + 'Connecting...'}${colors.reset}`);

  if (globalStats.errors.length > 0) {
    console.log(`\n  ${colors.red}Errors: ${globalStats.errors.length}${colors.reset}`);
    globalStats.errors.slice(-3).forEach((err) => console.log(`    - ${err}`));
  }

  console.log(`\n  Press Ctrl+C to stop`);
}

// Initialize connections
console.log(`${colors.blue}[INFO]${colors.reset} Initializing 9 orderbook connections...\n`);

SYMBOLS.forEach((symbol, position) => {
  const conn = new OrderBookConnection(symbol, position);
  globalStats.connections.set(symbol, conn);

  // Stagger connections by 100ms each
  setTimeout(() => {
    conn.connect();
  }, position * 100);
});

// Update display every 2 seconds
const displayInterval = setInterval(() => {
  displayGrid();
}, 2000);

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log(`\n${colors.blue}[INFO]${colors.reset} Shutting down gracefully...\n`);

  clearInterval(displayInterval);

  // Disconnect all
  globalStats.connections.forEach((conn) => {
    conn.disconnect();
  });

  // Final stats
  setTimeout(() => {
    displayGrid();

    console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.cyan}  Final Statistics${colors.reset}`);
    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);

    globalStats.connections.forEach((conn) => {
      const stats = conn.getStats();
      console.log(
        `  ${stats.symbol.padEnd(10)}: ${stats.messageCount} msgs, ${stats.deltaCount} deltas, ${stats.bidLevels}B/${stats.askLevels}A`
      );
    });

    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

    process.exit(0);
  }, 1000);
});
