# 🐂 BullBook - Visualizzatore Order Book Bybit Perpetual

Visualizzazione in tempo reale dell'order book per contratti perpetual Bybit con feed dati WebSocket L50.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://reactjs.org/)

---

## ✨ Caratteristiche

- 📊 **Order Book in Tempo Reale** - Dati L50 live da WebSocket Bybit
- 🎯 **Supporto Multi-Simbolo** - Monitora più coppie di trading simultaneamente
- 📱 **Design Responsivo** - Ottimizzato per desktop, tablet e mobile
- 🔐 **Autenticazione JWT** - Sistema di login sicuro
- ⚡ **Alte Prestazioni** - Rendering a 60 FPS con aggiornamenti ottimizzati
- 🎨 **UI Professionale** - Tema scuro ispirato alle piattaforme di trading professionali
- 📈 **Barre Volume** - Rappresentazione visuale della profondità dell'order book
- 🔄 **Auto-riconnessione** - Riconnessione automatica WebSocket in caso di disconnessione

---

## 🚀 Avvio Rapido

### Prerequisiti

- **Node.js** 18+ e npm 9+
- **Git**

### Installazione

1. **Clona il repository**:
   ```bash
   git clone https://github.com/DioNanos/BullBook.git
   cd BullBook
   ```

2. **Installa dipendenze backend**:
   ```bash
   cd backend
   npm install
   ```

3. **Installa dipendenze frontend**:
   ```bash
   cd ../frontend
   npm install
   ```

4. **Configura l'ambiente**:
   ```bash
   cd ../backend
   cp .env.example .env
   # Modifica .env con la tua configurazione
   ```

5. **Avvia il backend**:
   ```bash
   npm start
   ```

6. **Avvia il frontend** (in un altro terminale):
   ```bash
   cd frontend
   npm run dev
   ```

7. **Apri il browser**: http://localhost:5173

---

## 📖 Documentazione

- **[English README](README.md)** - English documentation
- **[Documentazione Script](scripts/README.md)** - Script di testing e deployment

---

## 🏗️ Architettura

```
BullBook/
├── backend/              # Node.js + Express + WebSocket
│   ├── src/
│   │   ├── server.js     # Server principale
│   │   ├── api/          # Endpoint REST API
│   │   ├── auth/         # Autenticazione JWT
│   │   ├── websocket/    # Proxy WebSocket Bybit
│   │   └── utils/        # Utility
│   ├── .env.example      # Template environment
│   └── package.json
├── frontend/             # React 18 + Vite 5
│   ├── src/
│   │   ├── App.jsx       # Componente principale
│   │   ├── components/   # Componenti React
│   │   ├── context/      # Context React (Auth, WebSocket)
│   │   ├── hooks/        # Hook personalizzati
│   │   └── utils/        # Utility frontend
│   └── package.json
└── scripts/              # Script utility
    ├── testing/          # Script di test
    └── deployment/       # Script di deployment
```

---

## 🛠️ Stack Tecnologico

### Backend
- **Node.js** - Ambiente di runtime
- **Express** - Framework web
- **ws** - Libreria WebSocket
- **JWT** - Autenticazione
- **dotenv** - Configurazione environment

### Frontend
- **React 18** - Libreria UI
- **Vite 5** - Build tool
- **CSS3** - Styling
- **WebSocket API** - Comunicazione real-time

### Fonte Dati
- **API WebSocket Bybit** - Canale orderbook.200.{symbol}

---

## 🔧 Configurazione

### Variabili d'Ambiente Backend

Crea `backend/.env` da `backend/.env.example`:

```env
# Server
PORT=3001
NODE_ENV=production

# CORS
CORS_ORIGIN=http://localhost:5173

# JWT
JWT_SECRET=la-tua-chiave-segreta-qui
JWT_EXPIRES_IN=7d

# Bybit WebSocket
BYBIT_WS_URL=wss://stream.bybit.com/v5/public/linear
```

### Utenti Predefiniti

Utenti demo per test (da cambiare in produzione):
- **admin** / **admin123**
- **demo** / **demo123**

---

## 🧪 Testing

```bash
# Testa connessione WebSocket Bybit
./scripts/testing/test-websocket.sh

# Testa dati orderbook
node scripts/testing/test-bybit-orderbook.js

# Testa simboli multipli
node scripts/testing/test-bybit-multi-orderbook.js

# Testa latenza
node scripts/testing/test-bybit-L1-latency.js
```

---

## 🐳 Supporto Docker

Build ed esecuzione con Docker:

```bash
# Build immagini
./scripts/deployment/docker-build.sh

# Esegui con docker-compose
docker-compose up -d
```

---

## 📝 Licenza

Questo progetto è distribuito con licenza MIT - vedi il file [LICENSE](LICENSE) per i dettagli.

---

## 🙏 Ringraziamenti

- **Scalping the Bull and Bull Family** - Per le preziose conoscenze di trading apprese dal miglior scalper e dalla migliore comunità italiana di trading
- **Bybit** - Per aver fornito API WebSocket gratuite
- **React** & **Vite** - Per lo stack frontend moderno
- **Express** & **ws** - Per l'infrastruttura backend

---

## 🔗 Link

- **GitHub**: https://github.com/DioNanos/BullBook
- **API Bybit**: https://bybit-exchange.github.io/docs/v5/ws/public/orderbook

---

## 📧 Contatti

Per domande o feedback, apri un issue su GitHub.

---

**Fatto con ❤️ per i trader**
