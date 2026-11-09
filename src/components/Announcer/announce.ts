import { createContext, useContext } from 'react';

export type Announce = (message: string) => void;

export const AnnounceContext = createContext<Announce | null>(null);

export function useAnnounce(): Announce {
  const value = useContext(AnnounceContext);
  if (!value) throw new Error('useAnnounce precisa estar dentro de <Announcer>');
  return value;
}
