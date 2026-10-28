import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * O build do RDM Studio: um bundle de navegador comum, não SSR.
 *
 * `outDir` grava direto em `backend/public/admin/rdm-studio` — `backend/` é
 * bind mount em `app` (ver `docker-compose.yml`), então não precisa de
 * nenhuma cópia extra no Dockerfile, o mesmo motivo por que `vendor/` do
 * Composer também não precisa. O prefixo `admin/` não é cosmético: é o que
 * faz `docker/web/default.conf` servir o arquivo direto do disco
 * (`location ~ ^/(api|admin|livewire)(/|$)`, `try_files`) em vez de cair no
 * `location /` do site público, que tem outra raiz (`/srv/site`) e nunca
 * acharia este caminho. Nomes fixos, não com hash: o Blade
 * (`resources/views/rdm-studio/`) referencia `admin.js`/`admin.css` direto —
 * a mesma convenção que o próprio Filament usa para os assets dele
 * (`public/js/filament/...`), sem cache-busting por hash.
 *
 * `generateScopedName` seria só para combinar com o build de cliente do site
 * público, e aqui não há motivo: o RDM Studio nunca importa um componente do
 * site público, então os dois nunca precisam produzir o mesmo nome de classe.
 */
export default defineConfig({
  plugins: [react()],
  // As fontes são referenciadas pelo CSS; sem isto saíam como `/assets/...`,
  // a raiz do site público, e davam 404 — o Studio caía na fonte do sistema.
  base: '/admin/rdm-studio/',
  // O `public/` da raiz é o do site (favicon do Cosmos, `demo/`); o Studio
  // tem a própria marca.
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
