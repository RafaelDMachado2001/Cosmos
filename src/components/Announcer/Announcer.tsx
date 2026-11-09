import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { AnnounceContext } from './announce';

const REPEAT_GAP_MS = 50;

export function Announcer({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  const timerRef = useRef<number | undefined>(undefined);

  const announce = useCallback((next: string) => {
    window.clearTimeout(timerRef.current);
    setMessage('');
    timerRef.current = window.setTimeout(() => {
      setMessage(next);
    }, REPEAT_GAP_MS);
  }, []);

  useEffect(
    () => () => {
      window.clearTimeout(timerRef.current);
    },
    [],
  );

  return (
    <AnnounceContext.Provider value={announce}>
      {children}
      <div className="visually-hidden" role="status" aria-live="polite" data-testid="announcer">
        {message}
      </div>
    </AnnounceContext.Provider>
  );
}
