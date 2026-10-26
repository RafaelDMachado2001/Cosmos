import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

import { resolveSiteOrigin } from './src/core/siteOrigin';

/**
 * O build dos módulos que rodam em Node, não no navegador.
 *
 * Dois entry points desde a fase do RDM Studio: o prerender (grava arquivo) e
 * `draft-blocks-cli` (ponte para `core/draftBlocks.ts`, chamado por `Process`
 * do Laravel). Os dois saem em `dist-ssr/`, a mesma pasta que
 * `docker/php/Dockerfile` copia para a imagem final — nenhum dos dois tem
 * acesso ao código-fonte lá, só a este diretório já compilado e ao
 * `node_modules`.
 *
 * Separado do `vite.config.ts` porque o alvo é outro. O que os dois precisam
 * ter idêntico está repetido de propósito — `generateScopedName` acima de tudo:
 * se os nomes de classe divergirem, o HTML gravado no disco sai sem estilo.
 */
export default defineConfig(({ mode }) => {
  // Prefixo vazio: PRERENDER_API_URL não vai para o bundle de cliente.
  const env = loadEnv(mode, '.', '');
  // A mesma regra do `vite.config.ts`: as duas origens precisam bater.
  const origin = resolveSiteOrigin(env);
  /*
   * O prerender roda em Node, onde não existe "mesma origem".
   *
   * `VITE_API_URL=/` resolve o navegador, mas aqui um caminho relativo não tem
   * contra o que resolver: o build precisa de um endereço completo. Daí
   * `PRERENDER_API_URL` — em Docker o navegador e o build alcançam a API por
   * nomes diferentes, e fingir o contrário só adiaria o erro para o deploy.
   */
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
      // Só este diretório: apagar o dist aqui destruiria o build de cliente
      // que acabou de rodar e de onde o prerender lê o template.
      emptyOutDir: true,
      // Sem isto o build de SSR descarta o CSS, e as páginas estáticas —
      // que são as únicas que usam esse CSS — sairiam sem estilo.
      ssrEmitAssets: true,
      cssCodeSplit: false,
      // Este CSS vai embutido em cada página gravada. O build de SSR não
      // minifica por padrão, e os comentários das folhas de estilo iam parar
      // no HTML servido.
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
