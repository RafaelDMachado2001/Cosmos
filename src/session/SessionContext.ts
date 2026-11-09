import { createContext } from 'react';

import type { Member, SessionState } from '../core/session';
import type { MemberPatch } from '../data/MemberSource';

export interface SessionValue {
  readonly state: SessionState;
  readonly exportUrl: string | null;
  readonly openLogin: (returnPath?: string) => void;
  readonly loginHrefs: (returnPath: string) => { readonly google: string; readonly github: string } | null;
  readonly retry: () => void;
  readonly signOut: () => Promise<void>;
  readonly update: (patch: MemberPatch) => Promise<Member>;
  readonly remove: () => Promise<void>;
}

export const SessionContext = createContext<SessionValue | null>(null);
