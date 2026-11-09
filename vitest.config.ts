import { defineConfig } from 'vitest/config';

const ORIGIN = (process.env.VITE_SITE_URL ?? 'http://localhost:5174').replace(/\/+$/, '');

const DOM = ['src/components/**', 'src/admin/**'];
const TESTS = ['src/**/*.test.ts', 'src/**/*.test.tsx', 'infra/**/*.test.ts'];

export default defineConfig({
  define: {
    __SITE_ORIGIN__: JSON.stringify(ORIGIN),
    __API_URL__: JSON.stringify(null),
    __ANALYTICS__: JSON.stringify(false),
  },
  test: {
    css: { include: [/src\/styles\/tokens\.css/] },
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: TESTS,
          exclude: DOM,
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: DOM.map((dir) => `${dir.replace(/\*\*$/, '')}**/*.test.{ts,tsx}`),
        },
      },
    ],
  },
});
