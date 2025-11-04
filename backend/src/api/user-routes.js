/**
 * BullBook - User Preferences Routes
 */

import express from 'express';
import { authMiddleware } from '../auth/jwt.js';
import { getUserPreferences, updateUserPreferences } from '../auth/users.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /api/user/preferences
 * Get user preferences
 */
router.get('/preferences', (req, res) => {
  const { username } = req.user;
  const preferences = getUserPreferences(username);

  if (!preferences) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ preferences });
});

/**
 * PUT /api/user/preferences
 * Update user preferences
 */
router.put('/preferences', (req, res) => {
  const { username } = req.user;
  const { preferences } = req.body;

  if (!preferences) {
    return res.status(400).json({ error: 'Preferences required' });
  }

  const success = updateUserPreferences(username, preferences);

  if (!success) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ message: 'Preferences updated' });
});

export default router;
