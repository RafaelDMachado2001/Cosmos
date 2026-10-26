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
    __ANALYTICS__: JSON.stringify(false),
  },
  test: {
    // Os módulos de `src/core/` são puros; o do prerender monta HTML por
    // string, sem DOM. Nada aqui precisa de navegador.
    environment: 'node',
    // Os componentes são a exceção: precisam de DOM, e só eles pagam por ele.
    // `src/admin/` e o RDM Studio — componentes também, pela mesma razão.
    environmentMatchGlobs: [
      ['src/components/**', 'jsdom'],
      ['src/admin/**', 'jsdom'],
    ],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'infra/**/*.test.ts'],
    // O Vitest esvazia todo CSS importado, inclusive com `?raw`. O cartão de
    // Open Graph lê as cores deste arquivo como texto, e o teste precisa delas.
    css: { include: [/src\/styles\/tokens\.css/] },
  },
});
