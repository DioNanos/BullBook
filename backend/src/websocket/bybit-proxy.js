/**
 * BullBook - Bybit WebSocket L50 Proxy
 *
 * Connects to Bybit WebSocket API and proxies orderbook.50 data to clients
 */

import { WebSocket, WebSocketServer } from 'ws';
import dotenv from 'dotenv';
dotenv.config();

const BYBIT_WS_URL = process.env.BYBIT_WS_URL || 'wss://stream.bybit.com/v5/public/linear';
const RECONNECT_DELAY = 5000; // 5 seconds
const HEARTBEAT_INTERVAL = 20000; // 20 seconds

class BybitProxy {
  constructor() {
    this.bybitWs = null;
    this.clientWss = null;
    this.subscribedSymbols = new Set();
    this.reconnectTimeout = null;
    this.heartbeatInterval = null;
    this.snapshotCache = new Map(); // Cache snapshots for new clients
  }

  /**
   * Initialize WebSocket server for clients
   */
  initializeServer(server) {
    this.clientWss = new WebSocketServer({ server, path: '/ws' });

    this.clientWss.on('connection', (ws) => {
      console.log('[WebSocket] Client connected');

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          this.handleClientMessage(ws, data);
        } catch (error) {
          console.error('[WebSocket] Parse error:', error.message);
        }
      });

      ws.on('close', () => {
        console.log('[WebSocket] Client disconnected');
      });

      ws.on('error', (error) => {
        console.error('[WebSocket] Client error:', error.message);
      });
    });

    console.log('[WebSocket] Server initialized on /ws');
  }

  /**
   * Connect to Bybit WebSocket
   */
  connectToBybit() {
    if (this.bybitWs) {
      this.bybitWs.terminate();
    }

    console.log('[Bybit] Connecting to', BYBIT_WS_URL);
    this.bybitWs = new WebSocket(BYBIT_WS_URL);

    this.bybitWs.on('open', () => {
      console.log('[Bybit] Connected');
      this.startHeartbeat();

      // Resubscribe to symbols if any
      if (this.subscribedSymbols.size > 0) {
        this.subscribeToSymbols([...this.subscribedSymbols]);
      }
    });

    this.bybitWs.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        this.handleBybitMessage(message);
      } catch (error) {
        console.error('[Bybit] Parse error:', error.message);
      }
    });

    this.bybitWs.on('close', () => {
      console.log('[Bybit] Connection closed');
      this.stopHeartbeat();
      this.scheduleReconnect();
    });

    this.bybitWs.on('error', (error) => {
      console.error('[Bybit] Error:', error.message);
    });
  }

  /**
   * Handle messages from clients
   */
  handleClientMessage(ws, data) {
    // Handle ping/pong keepalive
    if (data.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      return;
    }

    const { action, symbols, depth } = data;
    const orderDepth = depth || 50; // Default to 50 if not specified

    if (action === 'subscribe' && symbols && Array.isArray(symbols)) {
      console.log(`[Client] Subscribe request:`, symbols, `depth: ${orderDepth}`);
      this.subscribeToSymbols(symbols, orderDepth);

      // Send cached snapshots immediately to new client
      symbols.forEach(symbol => {
        const cacheKey = `${symbol}-${orderDepth}`;
        const cachedSnapshot = this.snapshotCache.get(cacheKey);
        if (cachedSnapshot) {
          console.log(`[Client] Sending cached snapshot for ${symbol} L${orderDepth}`);
          ws.send(JSON.stringify(cachedSnapshot));
        }
      });

      // Acknowledge subscription
      ws.send(JSON.stringify({
        type: 'subscribed',
        symbols,
        depth: orderDepth
      }));
    }

    if (action === 'unsubscribe' && symbols && Array.isArray(symbols)) {
      console.log(`[Client] Unsubscribe request:`, symbols, `depth: ${orderDepth}`);
      this.unsubscribeFromSymbols(symbols, orderDepth);
    }
  }

  /**
   * Subscribe to symbols on Bybit
   */
  subscribeToSymbols(symbols, depth = 50) {
    if (!this.bybitWs || this.bybitWs.readyState !== WebSocket.OPEN) {
      console.error('[Bybit] Cannot subscribe - not connected');
      return;
    }

    // Filter out already subscribed symbols to avoid "already subscribed" errors
    const newSymbols = symbols.filter(symbol => {
      const key = `${symbol}-${depth}`;
      return !this.subscribedSymbols.has(key);
    });

    if (newSymbols.length === 0) {
      console.log(`[Bybit] All symbols already subscribed, skipping:`, symbols, `depth: ${depth}`);
      return;
    }

    const args = newSymbols.map(symbol => `orderbook.${depth}.${symbol}`);

    this.bybitWs.send(JSON.stringify({
      op: 'subscribe',
      args
    }));

    newSymbols.forEach(symbol => this.subscribedSymbols.add(`${symbol}-${depth}`));
    console.log(`[Bybit] Subscribed to`, newSymbols, `depth: ${depth}`);

    // Log skipped symbols if any
    const skipped = symbols.filter(s => !newSymbols.includes(s));
    if (skipped.length > 0) {
      console.log(`[Bybit] Skipped already subscribed:`, skipped, `depth: ${depth}`);
    }
  }

  /**
   * Unsubscribe from symbols
   */
  unsubscribeFromSymbols(symbols, depth = 50) {
    if (!this.bybitWs || this.bybitWs.readyState !== WebSocket.OPEN) {
      return;
    }

    // Filter only actually subscribed symbols
    const subscribedSymbols = symbols.filter(symbol => {
      const key = `${symbol}-${depth}`;
      return this.subscribedSymbols.has(key);
    });

    if (subscribedSymbols.length === 0) {
      console.log(`[Bybit] No subscribed symbols to unsubscribe:`, symbols, `depth: ${depth}`);
      return;
    }

    const args = subscribedSymbols.map(symbol => `orderbook.${depth}.${symbol}`);

    this.bybitWs.send(JSON.stringify({
      op: 'unsubscribe',
      args
    }));

    subscribedSymbols.forEach(symbol => this.subscribedSymbols.delete(`${symbol}-${depth}`));
    console.log(`[Bybit] Unsubscribed from`, subscribedSymbols, `depth: ${depth}`);
  }

  /**
   * Handle messages from Bybit
   */
  handleBybitMessage(message) {
    // Heartbeat response
    if (message.op === 'pong') {
      return;
    }

    // Subscription response
    if (message.op === 'subscribe') {
      if (message.success) {
        console.log('[Bybit] Subscription confirmed');
      } else {
        console.error('[Bybit] Subscription failed:', message.ret_msg);
      }
      return;
    }

    // Orderbook data - cache snapshot and broadcast to all connected clients
    if (message.topic && message.topic.startsWith('orderbook')) {
      // Extract depth and symbol from topic (e.g., "orderbook.50.BTCUSDT" -> depth=50, symbol=BTCUSDT)
      const parts = message.topic.split('.');
      const depth = parts[1];
      const symbol = parts[2];

      // Cache snapshot for new clients (keyed by symbol-depth)
      if (message.type === 'snapshot') {
        const cacheKey = `${symbol}-${depth}`;
        console.log(`[Bybit] Caching snapshot for ${symbol} L${depth}`);
        this.snapshotCache.set(cacheKey, message);
      }

      // Debug: log asks and bids count
      const asksCount = message.data?.a?.length || 0;
      const bidsCount = message.data?.b?.length || 0;

      const clientCount = this.clientWss ? this.clientWss.clients.size : 0;
      console.log(`[Bybit] ${message.type} ${message.topic} | Asks: ${asksCount} | Bids: ${bidsCount} | Broadcasting to ${clientCount} clients`);
      this.broadcast(message);
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(message) {
    if (!this.clientWss) return;

    const data = JSON.stringify(message);

    this.clientWss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  /**
   * Start heartbeat to keep connection alive
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.bybitWs && this.bybitWs.readyState === WebSocket.OPEN) {
        this.bybitWs.send(JSON.stringify({ op: 'ping' }));
      }
    }, HEARTBEAT_INTERVAL);
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Schedule reconnection
   */
  scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    console.log(`[Bybit] Reconnecting in ${RECONNECT_DELAY / 1000}s...`);
    this.reconnectTimeout = setTimeout(() => {
      this.connectToBybit();
    }, RECONNECT_DELAY);
  }

  /**
   * Cleanup
   */
  cleanup() {
    this.stopHeartbeat();

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.bybitWs) {
      this.bybitWs.terminate();
    }

    if (this.clientWss) {
      this.clientWss.close();
    }
  }
}

// Singleton instance
const bybitProxy = new BybitProxy();

export default bybitProxy;
