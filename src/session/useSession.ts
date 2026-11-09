import { useContext } from 'react';

import { SessionContext } from './SessionContext';
import type { SessionValue } from './SessionContext';

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession precisa estar dentro de <SessionProvider>');
  return value;
}
