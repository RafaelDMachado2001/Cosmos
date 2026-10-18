<?php

declare(strict_types=1);

/*
 * Os dois hosts de produção da mesma aplicação (ver HostBoundary).
 *
 * Sem os dois, nada é restringido — é o `docker compose`, em que tudo
 * responde em localhost:8080.
 */
return [
    // Filament e RDM Studio. Cookie de sessão só deste host.
    'admin' => env('ADMIN_HOST'),
    // A API pública (e, na etapa 2, a sessão do leitor, no domínio do site).
    'api' => env('API_HOST'),
];
