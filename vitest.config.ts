import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Nenhum teste toca DOM, WebGL ou React: os módulos testados são puros.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
