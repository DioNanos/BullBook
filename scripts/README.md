# 🛠️ BullBook - Scripts

Utility scripts for testing, development, and deployment.

---

## 📁 Directory Structure

```
scripts/
├── README.md                           # This file
├── testing/                            # Test scripts
│   ├── test-bybit-orderbook.js         # Test orderbook WebSocket
│   ├── test-bybit-multi-orderbook.js   # Test multiple symbols
│   ├── test-bybit-L1-latency.js        # Test L1 data latency
│   └── test-websocket.sh               # Shell WebSocket test
└── deployment/                         # Deployment scripts
    └── docker-build.sh                 # Docker build script
```

---

## 🧪 Testing Scripts

### `testing/test-websocket.sh`
**Purpose**: Test Bybit WebSocket connection

**Usage:**
```bash
./scripts/testing/test-websocket.sh
```

**What it does:**
- ✅ Tests WebSocket connection to Bybit
- ✅ Subscribes to orderbook updates
- ✅ Shows real-time data stream
- ✅ Validates message format

---

### `testing/test-bybit-orderbook.js`
**Purpose**: Test orderbook data from Bybit API

**Usage:**
```bash
node scripts/testing/test-bybit-orderbook.js
```

**What it does:**
- ✅ Connects to Bybit WebSocket
- ✅ Subscribes to orderbook.200.BTCUSDT
- ✅ Displays bid/ask levels
- ✅ Calculates spread
- ✅ Shows update frequency

---

### `testing/test-bybit-multi-orderbook.js`
**Purpose**: Test multiple orderbooks simultaneously

**Usage:**
```bash
node scripts/testing/test-bybit-multi-orderbook.js
```

**What it does:**
- ✅ Tests multiple symbols (BTC, ETH, SOL, BNB)
- ✅ Monitors concurrent WebSocket connections
- ✅ Tracks update rates per symbol
- ✅ Memory usage monitoring

---

### `testing/test-bybit-L1-latency.js`
**Purpose**: Measure WebSocket data latency

**Usage:**
```bash
node scripts/testing/test-bybit-L1-latency.js
```

**What it does:**
- ✅ Measures Bybit → Client latency
- ✅ Tracks min/max/avg latency
- ✅ Shows real-time stats
- ✅ Performance benchmarking

---

## 🐳 Deployment Scripts

### `deployment/docker-build.sh`
**Purpose**: Build Docker images

**Usage:**
```bash
./scripts/deployment/docker-build.sh
```

**What it does:**
- ✅ Builds frontend Docker image
- ✅ Builds backend Docker image
- ✅ Tags images properly
- ✅ Validates build success

---

## 📝 Notes

- All scripts assume you're running from project root
- Node.js scripts require dependencies: `npm install`
- Shell scripts require bash and common utilities (curl, jq)
- Docker scripts require Docker installed and running

---

**Last Updated**: 2025-11-04
