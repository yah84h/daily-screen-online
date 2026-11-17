import { useEffect, useState } from 'react';

/** How long a media error stuck at 0% stays on the TV before it hides itself. */
export const STUCK_ERROR_MS = 8000;

/**
 * Returns true once `key` has stayed the same for `ms`. A new key (a different
 * error, or none) shows the message again, so fresh problems are still visible.
 */
export function useAutoHide(key: string | null, ms = STUCK_ERROR_MS) {
  const [hidden, setHidden] = useState<string | null>(null);
  useEffect(() => {
    if (!key) return;
    const timer = setTimeout(() => setHidden(key), ms);
    return () => clearTimeout(timer);
  }, [key, ms]);
  return !!key && hidden === key;
}
