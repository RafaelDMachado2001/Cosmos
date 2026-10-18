<?php

declare(strict_types=1);

/*
 * O tick do Cloud Scheduler (POST /api/internal/tick).
 *
 * O Scheduler assina cada chamada com um token OIDC da conta de serviço dele;
 * `VerifyGoogleOidc` só aceita token do Google, para esta audiência e desta
 * conta. Sem os dois configurados, a rota recusa tudo — falha fechada.
 */
return [
    'oidc_audience' => env('SCHEDULER_OIDC_AUDIENCE'),
    'service_account' => env('SCHEDULER_SERVICE_ACCOUNT'),
    'jwks_url' => 'https://www.googleapis.com/oauth2/v3/certs',
];
