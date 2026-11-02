<?php

declare(strict_types=1);

return [
    'site_dir' => env('SITE_DIR', '/srv/site'),
    'template_dir' => env('TEMPLATE_DIR', '/srv/render/dist-ssr'),
    'api_url' => env('PRERENDER_API_URL', 'http://web'),
    'render_dir' => env('RENDER_DIR', '/srv/render'),
    'internal_token' => env('PRERENDER_INTERNAL_TOKEN'),
    'rebuild_driver' => env('SITE_REBUILD_DRIVER', 'local'),
    'vercel_deploy_hook' => env('VERCEL_DEPLOY_HOOK_URL'),
    'rebuild_min_interval' => (int) env('SITE_REBUILD_MIN_INTERVAL', 60),
];
