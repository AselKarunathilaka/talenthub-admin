/**
 * securityLogger.js
 *
 * Utility for logging security actions even when `requireSecurityCheck === false`.
 * When security popup is disabled for a user, button clicks still need to send
 * WhatsApp/email alerts — they just skip the PIN entry step.
 *
 * Usage:
 *   import { logSecurityAction } from '../utils/securityLogger';
 *
 *   // In a click handler (before requireSecurityCheck bypass early-return):
 *   logSecurityAction({ action: 'manual attendance', extraInfo: 'Intern: John' });
 *   // Then proceed with the real action.
 */

import { API_BASE_URL } from '../api/apiConfig';

/**
 * Sends a security action log to the backend.
 * Does NOT throw — failures are swallowed so they never block the UI.
 *
 * @param {{ action: string, extraInfo?: string }} options
 */
export const logSecurityAction = ({ action, extraInfo } = {}) => {
  try {
    const adminInfo = JSON.parse(localStorage.getItem('adminInfo') || '{}');
    const token = adminInfo?.token;
    if (!token) return Promise.resolve();

    return fetch(`${API_BASE_URL}/admin/attendance/verify-security`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        securityPin: '',
        action: action || 'action performed',
        extraInfo: extraInfo || '',
      }),
    }).catch(() => {
      // Silently ignore network errors — don't block the real action
    });
  } catch {
    // Silently ignore any errors
    return Promise.resolve();
  }
};
