/**
 * BullBook - Logger Utility
 *
 * Logs authentication events and system activities
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_DIR = path.join(__dirname, '../../logs');
const AUTH_LOG = path.join(LOG_DIR, 'auth.log');
const SYSTEM_LOG = path.join(LOG_DIR, 'system.log');

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * Format timestamp for logs
 */
function formatTimestamp() {
  return new Date().toISOString();
}

/**
 * Write log entry to file
 */
function writeLog(filePath, message) {
  const timestamp = formatTimestamp();
  const logEntry = `[${timestamp}] ${message}\n`;

  try {
    fs.appendFileSync(filePath, logEntry, 'utf8');
  } catch (error) {
    console.error('[Logger] Failed to write log:', error.message);
  }
}

/**
 * Log authentication event (login/logout)
 */
export function logAuth(event, username, req = null) {
  // Get real IP behind reverse proxy (Apache)
  let ip = 'unknown';
  if (req) {
    // Try X-Forwarded-For first (Apache/Nginx reverse proxy)
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
      // X-Forwarded-For can be a comma-separated list, take first (client IP)
      ip = forwardedFor.split(',')[0].trim();
    } else {
      // Fallback to req.ip or connection IP
      ip = req.ip || req.connection?.remoteAddress || 'unknown';
    }
  }

  const userAgent = req ? (req.headers['user-agent'] || 'unknown') : 'unknown';

  const message = `${event.toUpperCase()} | User: ${username} | IP: ${ip} | UA: ${userAgent}`;

  writeLog(AUTH_LOG, message);
  console.log(`[Auth] ${message}`);
}

/**
 * Log system event
 */
export function logSystem(event, details = '') {
  const message = `${event} ${details ? `| ${details}` : ''}`;

  writeLog(SYSTEM_LOG, message);
  console.log(`[System] ${message}`);
}

/**
 * Log error
 */
export function logError(error, context = '') {
  const message = `ERROR ${context ? `[${context}]` : ''} | ${error.message || error}`;

  writeLog(SYSTEM_LOG, message);
  console.error(`[Error] ${message}`);
}

/**
 * Get recent auth logs (last N lines)
 */
export function getRecentAuthLogs(lines = 50) {
  try {
    if (!fs.existsSync(AUTH_LOG)) {
      return [];
    }

    const content = fs.readFileSync(AUTH_LOG, 'utf8');
    const allLines = content.trim().split('\n');

    return allLines.slice(-lines);
  } catch (error) {
    console.error('[Logger] Failed to read auth log:', error.message);
    return [];
  }
}

/**
 * Clear old logs (keep last N days)
 */
export function cleanOldLogs(daysToKeep = 30) {
  // TODO: Implement log rotation
  logSystem('Log cleanup', `Keeping last ${daysToKeep} days`);
}
