import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

import { resolveSiteOrigin } from './src/core/siteOrigin';

const DEFAULT_PORT = 5174;

export default defineConfig(({ mode }) => {
  // '.' já resolve para a raiz do projeto e evita depender de @types/node aqui.
  // Prefixo vazio para enxergar também as variáveis de sistema da Vercel
  // (ver `resolveSiteOrigin`); só o que `define` lista vai para o bundle.
  const env = loadEnv(mode, '.', '');
  const origin = resolveSiteOrigin(env);
  // Sem a variável, a constelação lê o acervo semente. Ver src/data/source.ts.
  const apiUrl = env.VITE_API_URL === undefined || env.VITE_API_URL === ''
    ? null
    : env.VITE_API_URL.replace(/\/+$/, '');
  // Mesma porta dentro e fora do container: assim o cliente do HMR acerta
  // o websocket sozinho, sem precisar de server.hmr.clientPort.
  const port = Number(env.VITE_PORT ?? DEFAULT_PORT);
  // A Vercel expõe VITE_VERCEL_ENV no build. Só a produção conta visita: nem os
  // previews das PRs nem o build local do Nginx carregam o script.
  const analytics = env.VITE_VERCEL_ENV === 'production';

  return {
    plugins: [react()],
    define: {
      __SITE_ORIGIN__: JSON.stringify(origin),
      __API_URL__: JSON.stringify(apiUrl),
      __ANALYTICS__: JSON.stringify(analytics),
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
      /*
       * A API no mesmo endereço do dev server.
       *
       * Com `VITE_API_URL=/` o adapter pede `/api/...` — mesma origem, sem
       * CORS, exatamente como em produção, onde o Nginx serve as duas coisas.
       * Em desenvolvimento quem faz esse papel é este proxy. O alvo é o nome do
       * serviço no compose porque o Vite roda dentro da rede do Docker.
       */
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY ?? 'http://web',
          changeOrigin: true,
        },
        // O login do leitor (/auth/{provider}/redirect, /callback, /logout).
        // Mantém o Host do Vite: o Laravel monta a URI de callback do OAuth
        // com ele, e ela precisa voltar por aqui, não pelo nome `web`.
        '/auth': {
          target: env.VITE_API_PROXY ?? 'http://web',
          changeOrigin: false,
        },
      },
      watch: {
        /*
         * `backend/` está aqui por causa do vendor do Composer: 16 mil arquivos
         * que o dev server não tem motivo nenhum para observar — nada em
         * backend/ é importado pelo frontend, a API é alcançada por HTTP.
         *
         * Sob inotify isso era só desperdício. Sob polling é fatal: varrer 16 mil
         * arquivos por tick através de um bind mount de drive Windows satura o
         * event loop e o Vite para de responder a HTTP, mesmo continuando a
         * detectar mudanças em src/.
         *
         * O Vite soma esta lista à dele, que já cobre .git e node_modules.
         */
        ignored: ['**/dist/**', '**/dist-ssr/**', '**/backend/**'],
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
