import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/admin/rdm-studio/',
  publicDir: 'src/admin/public',
  build: {
    target: 'es2020',
    outDir: 'backend/public/admin/rdm-studio',
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      input: 'src/admin/main.tsx',
      output: {
        entryFileNames: 'admin.js',
        assetFileNames: (asset) => (asset.name?.endsWith('.css') ? 'admin.css' : 'assets/[name][extname]'),
        inlineDynamicImports: true,
      },
    },
  },
});
