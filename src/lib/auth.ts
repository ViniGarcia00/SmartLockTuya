/**
 * Auth Utilities - Wrapper for middleware auth exports
 * Re-exports authentication functions for easier imports across the app
 * Note: middleware/auth.js is JavaScript, not TypeScript
 */

// Import from the root middleware directory
export { authenticateToken, logActivity } from '../../middleware/auth';

// Type definitions for TypeScript compatibility
export interface AuthRequest {
  user?: any;
  sessionId?: string;
}
