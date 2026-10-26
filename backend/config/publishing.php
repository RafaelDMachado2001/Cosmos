<?php

declare(strict_types=1);

return [
    'site_dir' => env('SITE_DIR', '/srv/site'),
    // dist-ssr e não dist: dist/index.html é a home composta depois do
    // postbuild. O molde intocado e dist-ssr/template.html. Ver Tarefa 2.
    'template_dir' => env('TEMPLATE_DIR', '/srv/render/dist-ssr'),
    'api_url' => env('PRERENDER_API_URL', 'http://web'),
    // O cwd de todo Process que chama "node dist-ssr/*.js" — RegenerateSite e
    // DraftBlocksCli. Em produção é o Dockerfile que grava ali; no job
    // "backend" do CI, sem Docker, é a raiz do checkout (ver ci.yml).
    'render_dir' => env('RENDER_DIR', '/srv/render'),
    // Isenta as chamadas do prerender do throttle público (ver AppServiceProvider).
    'internal_token' => env('PRERENDER_INTERNAL_TOKEN'),
    // `local`: RegenerateSite grava no volume do Nginx (docker compose).
    // `vercel`: o deploy hook da Vercel, cujo build lê a API. Ver SiteRebuild.
    'rebuild_driver' => env('SITE_REBUILD_DRIVER', 'local'),
    'vercel_deploy_hook' => env('VERCEL_DEPLOY_HOOK_URL'),
    'rebuild_min_interval' => (int) env('SITE_REBUILD_MIN_INTERVAL', 60),
];
