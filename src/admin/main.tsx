import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@fontsource/roboto/latin-300.css';
import '@fontsource/roboto/latin-400.css';
import '@fontsource/roboto/latin-500.css';
import '@fontsource/roboto/latin-ext-300.css';
import '@fontsource/roboto/latin-ext-400.css';
import '@fontsource/roboto/latin-ext-500.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-500.css';

import '../styles/tokens.css';
import '../styles/global.css';
import './admin.css';

import { AdminApp } from './AdminApp';
import { selectedFromSearch } from './selection';

const container = document.getElementById('admin-root');
if (!container) throw new Error('#admin-root não encontrado');

createRoot(container).render(
  <StrictMode>
    <AdminApp initialSelectedId={selectedFromSearch(window.location.search)} />
  </StrictMode>,
);
