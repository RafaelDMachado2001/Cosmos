import { defineConfig } from 'vitest/config';

/**
 * A mesma origem que o `vite.config.ts` assa no bundle.
 *
 * `src/site.ts` a lê pela constante, e sem ela aqui qualquer teste que toque no
 * SEO falha por referência indefinida — não por estar errado.
 */
const ORIGIN = (process.env.VITE_SITE_URL ?? 'http://localhost:5174').replace(/\/+$/, '');

export default defineConfig({
  define: {
    __SITE_ORIGIN__: JSON.stringify(ORIGIN),
    // Os testes nunca tocam rede: a fonte é sempre o acervo semente.
    __API_URL__: JSON.stringify(null),
  },
  test: {
    // Os módulos de `src/core/` são puros; o do prerender monta HTML por
    // string, sem DOM. Nada aqui precisa de navegador.
    environment: 'node',
    // Os componentes sao a excecao: precisam de DOM, e so eles pagam por ele.
    // `src/admin/` e o RDM Studio — componentes também, pela mesma razão.
    environmentMatchGlobs: [
      ['src/components/**', 'jsdom'],
      ['src/admin/**', 'jsdom'],
    ],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'infra/**/*.test.ts'],
    // O Vitest esvazia todo CSS importado, inclusive com `?raw`. O cartao de
    // Open Graph le as cores deste arquivo como texto, e o teste precisa delas.
    css: { include: [/src\/styles\/tokens\.css/] },
  },
});
