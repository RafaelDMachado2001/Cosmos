<?php

declare(strict_types=1);

return [
    'site_dir' => env('SITE_DIR', '/srv/site'),
    // dist-ssr e nao dist: dist/index.html e a home composta depois do
    // postbuild. O molde intocado e dist-ssr/template.html. Ver Tarefa 2.
    'template_dir' => env('TEMPLATE_DIR', '/srv/render/dist-ssr'),
    'api_url' => env('PRERENDER_API_URL', 'http://web'),
    // O cwd de todo Process que chama "node dist-ssr/*.js" — RegenerateSite e
    // DraftBlocksCli. Em produção é o Dockerfile que grava ali; no job
    // "backend" do CI, sem Docker, é a raiz do checkout (ver ci.yml).
    'render_dir' => env('RENDER_DIR', '/srv/render'),
    // Isenta as chamadas do prerender do throttle público (ver AppServiceProvider).
    'internal_token' => env('PRERENDER_INTERNAL_TOKEN'),
];
