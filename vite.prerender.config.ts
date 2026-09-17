import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * O build do passo de prerender.
 *
 * Separado do `vite.config.ts` porque o alvo é outro: aqui sai um módulo de
 * Node que grava arquivos, não um bundle de navegador. O que os dois precisam
 * ter idêntico está repetido de propósito — `generateScopedName` acima de tudo:
 * se os nomes de classe divergirem, o HTML gravado no disco sai sem estilo.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  const origin = (env.VITE_SITE_URL ?? 'http://localhost:5174').replace(/\/+$/, '');

  return {
    plugins: [react()],
    define: {
      __SITE_ORIGIN__: JSON.stringify(origin),
    },
    css: {
      modules: { generateScopedName: '[name]_[local]_[hash:base64:5]' },
    },
    build: {
      ssr: 'src/prerender/main.ts',
      outDir: 'dist-ssr',
      // Só este diretório: apagar o dist aqui destruiria o build de cliente
      // que acabou de rodar e de onde o prerender lê o template.
      emptyOutDir: true,
      // Sem isto o build de SSR descarta o CSS, e as páginas estáticas —
      // que são as únicas que usam esse CSS — sairiam sem estilo.
      ssrEmitAssets: true,
      cssCodeSplit: false,
      target: 'node20',
      rollupOptions: {
        output: { entryFileNames: 'prerender.js' },
      },
    },
  };
});
