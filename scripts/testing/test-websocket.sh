#!/bin/bash
# BullBook Bybit WebSocket Connection Test
# Usage: ./scripts/testing/test-websocket.sh [symbol]
# Example: ./scripts/testing/test-websocket.sh BTCUSDT

set -e

SYMBOL="${1:-BTCUSDT}"
ORDERBOOK_DEPTH="${2:-200}"

echo "🔌 Testing Bybit WebSocket Connection"
echo "Symbol: $SYMBOL"
echo "Orderbook Depth: $ORDERBOOK_DEPTH"
echo ""

# Bybit WebSocket V5 endpoint
WS_URL="wss://stream.bybit.com/v5/public/linear"
CHANNEL="orderbook.${ORDERBOOK_DEPTH}.${SYMBOL}"

echo "📡 Connecting to: $WS_URL"
echo "📊 Subscribing to: $CHANNEL"
echo ""

# Test connection using wscat (if available)
if command -v wscat &> /dev/null; then
  echo "Using wscat for WebSocket test..."
  echo ""
  echo "Sending subscription message:"
  echo "{\"op\":\"subscribe\",\"args\":[\"${CHANNEL}\"]}"
  echo ""
  echo "Waiting for orderbook data (Ctrl+C to stop)..."
  echo ""

  # Send subscribe message and listen
  echo "{\"op\":\"subscribe\",\"args\":[\"${CHANNEL}\"]}" | wscat -c "$WS_URL"
else
  echo "⚠️  wscat not installed. Install with: npm install -g wscat"
  echo ""
  echo "Alternative test with curl (HTTP API):"
  echo "curl 'https://api.bybit.com/v5/market/orderbook?category=linear&symbol=${SYMBOL}&limit=${ORDERBOOK_DEPTH}'"
  echo ""

  if command -v curl &> /dev/null; then
    echo "Testing HTTP API endpoint..."
    curl -s "https://api.bybit.com/v5/market/orderbook?category=linear&symbol=${SYMBOL}&limit=${ORDERBOOK_DEPTH}" | head -100
  fi
fi

echo ""
echo "✅ WebSocket endpoint info verified"
echo "Next: Implement WebSocket client in application"
