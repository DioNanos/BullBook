/**
 * BullBook - Authentication Routes
 */

import express from 'express';
import { validateCredentials } from '../auth/users.js';
import { generateToken, verifyToken } from '../auth/jwt.js';
import { logAuth, getRecentAuthLogs } from '../utils/logger.js';

const router = express.Router();

/**
 * POST /api/auth/login
 * Login with username and password
 */
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    logAuth('LOGIN_FAILED', username || 'unknown', req);
    return res.status(400).json({ error: 'Username and password required' });
  }

  const user = validateCredentials(username, password);

  if (!user) {
    logAuth('LOGIN_FAILED', username, req);
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = generateToken(user);

  // Log successful login
  logAuth('LOGIN_SUCCESS', username, req);

  res.json({
    token,
    user: {
      username: user.username,
      preferences: user.preferences
    }
  });
});

/**
 * GET /api/auth/logs
 * Get recent authentication logs (protected - requires valid token)
 */
router.get('/logs', (req, res) => {
  // Verify token
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Authorization required' });
  }

  try {
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get recent logs
    const lines = parseInt(req.query.lines) || 50;
    const logs = getRecentAuthLogs(lines);

    res.json({
      logs,
      count: logs.length
    });
  } catch (error) {
    console.error('[Auth] Failed to get logs:', error);
    res.status(500).json({ error: 'Failed to retrieve logs' });
  }
});

export default router;
