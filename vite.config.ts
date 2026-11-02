import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

import { resolveSiteOrigin } from './src/core/siteOrigin';

const DEFAULT_PORT = 5174;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const origin = resolveSiteOrigin(env);
  const apiUrl = env.VITE_API_URL === undefined || env.VITE_API_URL === ''
    ? null
    : env.VITE_API_URL.replace(/\/+$/, '');
  const port = Number(env.VITE_PORT ?? DEFAULT_PORT);
  const analytics = env.VITE_VERCEL_ENV === 'production';

  return {
    plugins: [react()],
    define: {
      __SITE_ORIGIN__: JSON.stringify(origin),
      __API_URL__: JSON.stringify(apiUrl),
      __ANALYTICS__: JSON.stringify(analytics),
    },
    css: {
      modules: { generateScopedName: '[name]_[local]_[hash:base64:5]' },
    },
    server: {
      host: true,
      port,
      strictPort: true,
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY ?? 'http://web',
          changeOrigin: true,
        },
        '/auth': {
          target: env.VITE_API_PROXY ?? 'http://web',
          changeOrigin: false,
        },
      },
      watch: {
        ignored: ['**/dist/**', '**/dist-ssr/**', '**/backend/**'],
        usePolling: env.VITE_POLLING === '1',
      },
    },
    preview: { host: true, port: 4173 },
    build: {
      target: 'es2020',
      cssCodeSplit: false,
      manifest: true,
      rollupOptions: {
        output: {
          manualChunks: (id) => (id.includes('node_modules/three') ? 'three' : undefined),
        },
      },
    },
  };
});
