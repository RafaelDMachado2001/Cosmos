<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Here you may configure your settings for cross-origin resource sharing
    | or "CORS". This determines what cross-origin operations may execute
    | in web browsers. You are free to adjust these settings as needed.
    |
    | To learn more: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
    |
    */

    // Só o que carrega a sessão do leitor: credenciais e a origem exata do
    // site. A leitura pública (/api/publications) não passa por aqui —
    // PublicCors a abre para qualquer origem, sem credencial.
    'paths' => ['api/me', 'api/me/*', 'api/sanctum/csrf-cookie', 'auth/logout'],

    'allowed_methods' => ['GET', 'PATCH', 'POST', 'DELETE'],

    'allowed_origins' => array_filter([(string) env('SITE_URL')]),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['Accept', 'Content-Type', 'X-Requested-With', 'X-XSRF-TOKEN'],

    'exposed_headers' => [],

    'max_age' => 600,

    'supports_credentials' => true,

];
