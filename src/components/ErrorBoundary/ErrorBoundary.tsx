import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

import { restoreShell } from '../../prerenderShell';

interface Props {
  readonly children: ReactNode;
}

interface State {
  readonly failed: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('A constelacao falhou; a casca pre-renderizada fica no lugar.', error, info);
    document.getElementById('root')?.setAttribute('hidden', '');
    restoreShell();
  }

  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
