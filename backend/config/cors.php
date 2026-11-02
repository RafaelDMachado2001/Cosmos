<?php

return [

    'paths' => ['api/me', 'api/me/*', 'api/sanctum/csrf-cookie', 'auth/logout'],

    'allowed_methods' => ['GET', 'PATCH', 'POST', 'DELETE'],

    'allowed_origins' => array_filter([(string) env('SITE_URL')]),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['Accept', 'Content-Type', 'X-Requested-With', 'X-XSRF-TOKEN'],

    'exposed_headers' => [],

    'max_age' => 600,

    'supports_credentials' => true,

];
