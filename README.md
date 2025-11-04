# 🐂 BullBook - Bybit Perpetual Order Book Viewer

Real-time order book visualization for Bybit perpetual contracts with WebSocket L50 data feed.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://reactjs.org/)

---

## ✨ Features

- 📊 **Real-time Order Book** - Live L50 depth data from Bybit WebSocket
- 🎯 **Multi-Symbol Support** - Monitor multiple trading pairs simultaneously
- 📱 **Responsive Design** - Optimized for desktop, tablet, and mobile
- 🔐 **JWT Authentication** - Secure login system
- ⚡ **High Performance** - 60 FPS rendering with optimized updates
- 🎨 **Professional UI** - Dark theme inspired by professional trading platforms
- 📈 **Volume Bars** - Visual representation of order book depth
- 🔄 **Auto-reconnect** - Automatic WebSocket reconnection on disconnect

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm 9+
- **Git**

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/DioNanos/BullBook.git
   cd BullBook
   ```

2. **Install backend dependencies**:
   ```bash
   cd backend
   npm install
   ```

3. **Install frontend dependencies**:
   ```bash
   cd ../frontend
   npm install
   ```

4. **Configure environment**:
   ```bash
   cd ../backend
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Start backend**:
   ```bash
   npm start
   ```

6. **Start frontend** (in another terminal):
   ```bash
   cd frontend
   npm run dev
   ```

7. **Open browser**: http://localhost:5173

---

## 📖 Documentation

- **[Italian README](README.it.md)** - Documentazione in italiano
- **[Scripts Documentation](scripts/README.md)** - Testing and deployment scripts

---

## 🏗️ Architecture

```
BullBook/
├── backend/              # Node.js + Express + WebSocket
│   ├── src/
│   │   ├── server.js     # Main server
│   │   ├── api/          # REST API endpoints
│   │   ├── auth/         # JWT authentication
│   │   ├── websocket/    # Bybit WebSocket proxy
│   │   └── utils/        # Utilities
│   ├── .env.example      # Environment template
│   └── package.json
├── frontend/             # React 18 + Vite 5
│   ├── src/
│   │   ├── App.jsx       # Main component
│   │   ├── components/   # React components
│   │   ├── context/      # React context (Auth, WebSocket)
│   │   ├── hooks/        # Custom hooks
│   │   └── utils/        # Frontend utilities
│   └── package.json
└── scripts/              # Utility scripts
    ├── testing/          # Test scripts
    └── deployment/       # Deployment scripts
```

---

## 🛠️ Tech Stack

### Backend
- **Node.js** - Runtime environment
- **Express** - Web framework
- **ws** - WebSocket library
- **JWT** - Authentication
- **dotenv** - Environment configuration

### Frontend
- **React 18** - UI library
- **Vite 5** - Build tool
- **CSS3** - Styling
- **WebSocket API** - Real-time communication

### Data Source
- **Bybit WebSocket API** - orderbook.200.{symbol} channel

---

## 🔧 Configuration

### Backend Environment Variables

Create `backend/.env` from `backend/.env.example`:

```env
# Server
PORT=3001
NODE_ENV=production

# CORS
CORS_ORIGIN=http://localhost:5173

# JWT
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=7d

# Bybit WebSocket
BYBIT_WS_URL=wss://stream.bybit.com/v5/public/linear
```

### Default Users

Demo users for testing (change in production):
- **admin** / **admin123**
- **demo** / **demo123**

---

## 🧪 Testing

```bash
# Test Bybit WebSocket connection
./scripts/testing/test-websocket.sh

# Test orderbook data
node scripts/testing/test-bybit-orderbook.js

# Test multiple symbols
node scripts/testing/test-bybit-multi-orderbook.js

# Test latency
node scripts/testing/test-bybit-L1-latency.js
```

---

## 🐳 Docker Support

Build and run with Docker:

```bash
# Build images
./scripts/deployment/docker-build.sh

# Run with docker-compose
docker-compose up -d
```

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Scalping the Bull and Bull Family** - For invaluable trading knowledge from the best scalper and the best Italian trading community
- **Bybit** - For providing free WebSocket API
- **React** & **Vite** - For the modern frontend stack
- **Express** & **ws** - For the backend infrastructure

---

## 🔗 Links

- **GitHub**: https://github.com/DioNanos/BullBook
- **Bybit API**: https://bybit-exchange.github.io/docs/v5/ws/public/orderbook

---

## 📧 Contact

For questions or feedback, please open an issue on GitHub.

---

**Made with ❤️ for traders**
