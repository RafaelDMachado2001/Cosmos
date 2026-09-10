import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

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

// O HTML pré-renderizado é uma casca descartável: some antes do React montar,
// então nada hidrata e não existe risco de mismatch.
document.getElementById('prerender')?.remove();

const container = document.getElementById('root');
if (!container) throw new Error('#root não encontrado');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
