/**
 * BullBook - User Management (v1.0 Simplified)
 *
 * Only 2 users: dag and bull
 * Passwords stored in .env (temporary - v2.0 will use NexusChat API)
 */

import dotenv from 'dotenv';
dotenv.config();

// Hardcoded users for v1.0
const users = [
  {
    username: 'dag',
    password: process.env.USER_DAG_PASSWORD || 'dag123', // Change in .env!
    enabled: true, // ✅ ACTIVE
    preferences: {
      symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'], // Default preset: 3 books
      volumeThreshold: 0, // No filter - show all coins
      layout: {}
    }
  },
  {
    username: 'bull',
    password: process.env.USER_BULL_PASSWORD || 'bull123', // Change in .env!
    enabled: true, // ✅ ACTIVE (2025-10-30)
    preferences: {
      symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'], // Default preset: 3 books
      volumeThreshold: 0, // No filter - show all coins
      layout: {}
    }
  },
  {
    username: 'Senior',
    password: process.env.USER_SENIOR_PASSWORD || 'senior123', // Change in .env!
    enabled: true, // ✅ ACTIVE (2025-10-30)
    preferences: {
      symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'], // Default preset: 3 books
      volumeThreshold: 0, // No filter - show all coins
      depth: 20,
      priceDecimals: 1,
      sizeDecimals: 2,
      layout: {}
    }
  },
  {
    username: 'piva',
    password: process.env.USER_PIVA_PASSWORD || 'piva123', // Change in .env!
    enabled: true, // ✅ ACTIVE (2025-10-30)
    preferences: {
      symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'], // Default preset: 3 books
      volumeThreshold: 0, // No filter - show all coins
      layout: {}
    }
  },
  {
    username: 'ziodoc',
    password: process.env.USER_ZIODOC_PASSWORD || 'ziodoc123', // Change in .env!
    enabled: true, // ✅ ACTIVE (2025-10-30)
    preferences: {
      symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'], // Default preset: 3 books
      volumeThreshold: 0, // No filter - show all coins
      layout: {}
    }
  },
  {
    username: 'matte',
    password: process.env.USER_MATTE_PASSWORD || 'matte123', // Change in .env!
    enabled: true, // ✅ ACTIVE (2025-10-30)
    preferences: {
      symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'], // Default preset: 3 books
      volumeThreshold: 0, // No filter - show all coins
      layout: {}
    }
  },
  {
    username: 'Pask',
    password: process.env.USER_PASK_PASSWORD || 'pask123', // Change in .env!
    enabled: true, // ✅ ACTIVE (2025-10-30)
    preferences: {
      symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'], // Default preset: 3 books
      volumeThreshold: 0, // No filter - show all coins
      layout: {}
    }
  },
  {
    username: 'drfrank',
    password: process.env.USER_DRFRANK_PASSWORD || 'drfrank123', // Change in .env!
    enabled: true, // ✅ ACTIVE (2025-11-02)
    preferences: {
      symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'], // Default preset: 3 books
      volumeThreshold: 0, // No filter - show all coins
      layout: {}
    }
  }
];

/**
 * Find user by username
 */
export function findUser(username) {
  return users.find(u => u.username === username);
}

/**
 * Validate user credentials
 */
export function validateCredentials(username, password) {
  const user = findUser(username);
  if (!user) return null;

  // Check if user is enabled
  if (user.enabled === false) {
    console.log(`[Auth] Login denied - user '${username}' is disabled`);
    return null;
  }

  if (user.password === password) {
    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  return null;
}

/**
 * Get user preferences
 */
export function getUserPreferences(username) {
  const user = findUser(username);
  return user ? user.preferences : null;
}

/**
 * Update user preferences (in-memory for v1.0)
 */
export function updateUserPreferences(username, preferences) {
  const user = findUser(username);
  if (!user) return false;

  user.preferences = { ...user.preferences, ...preferences };
  return true;
}
