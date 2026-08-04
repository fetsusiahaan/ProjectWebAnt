import { CHAT_CONFIG } from '../../config/chatConfig';
import type { LimitData } from './types';

const SESSION_DURATION = CHAT_CONFIG.sessionDurationMs;
const BLOCK_DURATION = CHAT_CONFIG.blockDurationMs;

export function storageKey(ip: string) {
  return `fetsubot_limit_${ip}`;
}

export function loadLimit(ip: string): LimitData {
  try {
    const raw = localStorage.getItem(storageKey(ip));
    if (!raw) return { sessionStart: Date.now(), totalTokens: 0, blockedAt: null };
    const data: LimitData = JSON.parse(raw);

    // Check block status first
    if (data.blockedAt) {
      if (Date.now() - data.blockedAt >= BLOCK_DURATION) {
        // Block duration expired -> reset everything
        return { sessionStart: Date.now(), totalTokens: 0, blockedAt: null };
      }
    } else if (Date.now() - data.sessionStart >= SESSION_DURATION) {
      // Normal session reset (15 min)
      return { sessionStart: Date.now(), totalTokens: 0, blockedAt: null };
    }
    return data;
  } catch { return { sessionStart: Date.now(), totalTokens: 0, blockedAt: null }; }
}

export function saveLimit(ip: string, data: LimitData) {
  try { localStorage.setItem(storageKey(ip), JSON.stringify(data)); } catch { /* noop */ }
}

export function formatMs(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export function calculateTimeLeft(limit: LimitData): number {
  if (limit.blockedAt) {
    return BLOCK_DURATION - (Date.now() - limit.blockedAt);
  }
  return SESSION_DURATION - (Date.now() - limit.sessionStart);
}
