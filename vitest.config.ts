import { defineConfig } from 'vitest/config';

const ORIGIN = (process.env.VITE_SITE_URL ?? 'http://localhost:5174').replace(/\/+$/, '');

export default defineConfig({
  define: {
    __SITE_ORIGIN__: JSON.stringify(ORIGIN),
    __API_URL__: JSON.stringify(null),
    __ANALYTICS__: JSON.stringify(false),
  },
  test: {
    environment: 'node',
    environmentMatchGlobs: [
      ['src/components/**', 'jsdom'],
      ['src/admin/**', 'jsdom'],
    ],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'infra/**/*.test.ts'],
    css: { include: [/src\/styles\/tokens\.css/] },
  },
});
