export function ipToUuid(ip: string): string {
  let hash1 = 0;
  let hash2 = 0;
  for (let i = 0; i < ip.length; i++) {
    const char = ip.charCodeAt(i);
    hash1 = ((hash1 << 5) - hash1) + char;
    hash1 |= 0;
  }
  for (let i = ip.length - 1; i >= 0; i--) {
    const char = ip.charCodeAt(i);
    hash2 = ((hash2 << 7) - hash2) + char;
    hash2 |= 0;
  }

  const h1 = Math.abs(hash1).toString(16).padStart(8, '0');
  const h2 = Math.abs(hash2).toString(16).padStart(8, '0');

  const p1 = h1.slice(0, 8);
  const p2 = h2.slice(0, 4);
  const p3 = '4' + h2.slice(4, 7);
  const p4 = 'a' + h1.slice(0, 3);
  const p5 = (h1 + h2 + h1).slice(0, 12).padStart(12, '0');

  return `${p1}-${p2}-${p3}-${p4}-${p5}`;
}

export interface ChatSessionJSON {
  sessionId: string;
  ip: string;
  createdAt: string;
  lastActive: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: Array<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  history: Array<any>;
  limitData: { sessionStart: number; totalTokens: number };
}

export function sessionStorageKey(sid: string) {
  return `fetsubot_session_${sid}`;
}

export function loadSessionJSON(sid: string): ChatSessionJSON | null {
  try {
    const raw = localStorage.getItem(sessionStorageKey(sid));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveSessionJSON(session: ChatSessionJSON): boolean {
  try {
    // No pretty-printing: indentation inflates the payload against a ~5 MB quota
    // for bytes nobody reads.
    localStorage.setItem(sessionStorageKey(session.sessionId), JSON.stringify(session));

    // Also update master IP & Sessions JSON registry
    const registryRaw = localStorage.getItem('fetsubot_sessions_registry_json') || '{}';
    const registry = JSON.parse(registryRaw);
    registry[session.sessionId] = {
      ip: session.ip,
      lastActive: session.lastActive,
      messageCount: session.messages ? session.messages.length : 0,
    };
    localStorage.setItem('fetsubot_sessions_registry_json', JSON.stringify(registry));
    return true;
  } catch (err) {
    console.warn('Session persist failed (storage quota?):', err);
    return false;
  }
}
