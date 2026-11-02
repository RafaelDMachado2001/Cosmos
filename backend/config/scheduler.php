<?php

declare(strict_types=1);

return [
    'oidc_audience' => env('SCHEDULER_OIDC_AUDIENCE'),
    'service_account' => env('SCHEDULER_SERVICE_ACCOUNT'),
    'jwks_url' => 'https://www.googleapis.com/oauth2/v3/certs',
];
