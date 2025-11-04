#!/usr/bin/env node
/**
 * BullBook Backend Server
 *
 * - Express REST API for auth and preferences
 * - WebSocket proxy for Bybit L50 orderbook
 * - JWT authentication
 */

import express from 'express';
import cors from 'cors';
import http from 'http';
import dotenv from 'dotenv';
import authRoutes from './api/auth-routes.js';
import userRoutes from './api/user-routes.js';
import bybitProxy from './websocket/bybit-proxy.js';
import { logSystem } from './utils/logger.js';

dotenv.config();

const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

// Express app
const app = express();

// Trust proxy (behind Apache reverse proxy)
app.set('trust proxy', true);

// Middleware
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    bybit: bybitProxy.bybitWs?.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[Server] Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket proxy
bybitProxy.initializeServer(server);
bybitProxy.connectToBybit();

// Start server
server.listen(PORT, () => {
  console.log(`
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  🐂 BullBook Backend Server                         ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃  HTTP Server:    http://localhost:${PORT}               ┃
┃  WebSocket:      ws://localhost:${PORT}/ws              ┃
┃  Environment:    ${process.env.NODE_ENV || 'development'}            ┃
┃  CORS Origin:    ${CORS_ORIGIN}  ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
  `);

  // Log server startup
  logSystem('SERVER_START', `Port ${PORT} | Env: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down gracefully...');
  logSystem('SERVER_SHUTDOWN', 'SIGINT received');

  bybitProxy.cleanup();

  server.close(() => {
    console.log('[Server] Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n[Server] SIGTERM received, shutting down...');
  logSystem('SERVER_SHUTDOWN', 'SIGTERM received');

  bybitProxy.cleanup();

  server.close(() => {
    console.log('[Server] Server closed');
    process.exit(0);
  });
});
