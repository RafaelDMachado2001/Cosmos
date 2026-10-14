<?php

declare(strict_types=1);

// O unico administrador do painel, criado pelo DatabaseSeeder. Os valores vem
// do ambiente para nao existir credencial escrita no repositorio; env() so e
// lido aqui, porque com o config em cache ele devolve null fora de config/.

return [
    'name' => env('ADMIN_NAME', 'RDM Labs'),
    'email' => env('ADMIN_EMAIL', 'admin@rdmlabs.dev'),
    'password' => env('ADMIN_PASSWORD', 'changeme'),
];
