import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  readonly children: ReactNode;
}

interface State {
  readonly failed: boolean;
}

/**
 * Quando o React quebra, quem estava lendo continua lendo.
 *
 * A casca pre-renderizada ja tem o artigo inteiro no HTML. Este limite esconde
 * o `#root` e deixa a casca no lugar, em vez de trocar texto por tela preta.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('A constelacao falhou; a casca pre-renderizada fica no lugar.', error, info);
    document.getElementById('root')?.setAttribute('hidden', '');
    document.getElementById('prerender')?.removeAttribute('hidden');
  }

  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
