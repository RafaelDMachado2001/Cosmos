import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const DEFAULT_PORT = 5174;
const FALLBACK_URL = `http://localhost:${DEFAULT_PORT}`;

export default defineConfig(({ mode }) => {
  // '.' já resolve para a raiz do projeto e evita depender de @types/node aqui.
  const env = loadEnv(mode, '.', 'VITE_');
  const origin = (env.VITE_SITE_URL ?? FALLBACK_URL).replace(/\/+$/, '');
  // Mesma porta dentro e fora do container: assim o cliente do HMR acerta
  // o websocket sozinho, sem precisar de server.hmr.clientPort.
  const port = Number(env.VITE_PORT ?? DEFAULT_PORT);

  return {
    plugins: [react()],
    define: {
      __SITE_ORIGIN__: JSON.stringify(origin),
    },
    css: {
      // Fixo porque o build de SSR (prerender) precisa gerar exatamente os mesmos
      // nomes de classe do build de cliente; se divergirem, o artigo sai sem estilo.
      modules: { generateScopedName: '[name]_[local]_[hash:base64:5]' },
    },
    server: {
      // Sem host:true o Vite escuta só em 127.0.0.1 e fica invisível fora do container.
      host: true,
      port,
      strictPort: true,
      watch: {
        ignored: ['**/dist/**', '**/dist-ssr/**'],
        // inotify atravessa bind mount no Linux nativo; polling só onde não atravessa.
        usePolling: env.VITE_POLLING === '1',
      },
    },
    preview: { host: true, port: 4173 },
    build: {
      target: 'es2020',
      cssCodeSplit: false,
      // O script de prerender lê dist/.vite/manifest.json para achar o JS/CSS com hash.
      manifest: true,
      rollupOptions: {
        output: {
          manualChunks: (id) => (id.includes('node_modules/three') ? 'three' : undefined),
        },
      },
    },
  };
});
