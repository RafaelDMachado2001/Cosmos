import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

import { resolveSiteOrigin } from './src/core/siteOrigin';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const origin = resolveSiteOrigin(env);
  const configured = env.PRERENDER_API_URL ?? env.VITE_API_URL;
  const apiUrl =
    configured === undefined || configured === '' || configured === '/'
      ? null
      : configured.replace(/\/+$/, '');

  return {
    plugins: [react()],
    define: {
      __SITE_ORIGIN__: JSON.stringify(origin),
      __API_URL__: JSON.stringify(apiUrl),
    },
    css: {
      modules: { generateScopedName: '[name]_[local]_[hash:base64:5]' },
    },
    build: {
      ssr: true,
      outDir: 'dist-ssr',
      emptyOutDir: true,
      ssrEmitAssets: true,
      cssCodeSplit: false,
      cssMinify: true,
      target: 'node20',
      rollupOptions: {
        input: {
          prerender: 'src/prerender/main.ts',
          'draft-blocks-cli': 'scripts/draft-blocks-cli.ts',
        },
        output: { entryFileNames: '[name].js' },
      },
    },
  };
});
