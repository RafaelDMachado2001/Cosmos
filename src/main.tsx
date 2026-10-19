import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';

// Só latin e latin-ext: o site é PT/EN, e os subsets cirílico, grego, vietnamita
// e math respondiam por dois terços do CSS.
import '@fontsource/roboto/latin-300.css';
import '@fontsource/roboto/latin-400.css';
import '@fontsource/roboto/latin-500.css';
import '@fontsource/roboto/latin-ext-300.css';
import '@fontsource/roboto/latin-ext-400.css';
import '@fontsource/roboto/latin-ext-500.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import '@fontsource/jetbrains-mono/latin-ext-400.css';
import '@fontsource/jetbrains-mono/latin-ext-500.css';

import './styles/tokens.css';
import './styles/reset.css';
import './styles/global.css';

import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary';

// O HTML pré-renderizado é uma casca: nada hidrata, então não existe risco de
// mismatch. Ela só sai depois de o React montar (ver `App`), e volta se ele
// quebrar (ver `ErrorBoundary`).
const container = document.getElementById('root');
if (!container) throw new Error('#root não encontrado');

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
    {/*
     * Sem cookie e sem identificador persistente: conta visita sem dado pessoal,
     * então não pede banner de consentimento. O script vem de
     * /_vercel/insights/, a mesma origem, e cabe na CSP (`script-src 'self'`).
     */}
    {__ANALYTICS__ && <Analytics />}
  </StrictMode>,
);
