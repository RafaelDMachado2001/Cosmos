export const REFERENCE_DIAGRAM = `flow caminho-php
title: O caminho de uma request até o PHP

navegador  "Navegador"  / cliente
nginx      "NGINX"      / servidor web
disco      "public/"    / arquivo estático
fpm        "PHP-FPM"    / process manager
php        "index.php"  / front controller

navegador -> nginx : HTTPS
nginx     -> disco : arquivo existe? | existe?
nginx     -> fpm   : FastCGI · unix socket | FastCGI
fpm       -> php   : executa`;

export const REFERENCE_DIAGRAM_EN = `flow caminho-php
title: The path of a request to PHP

navegador  "Browser"    / client
nginx      "NGINX"      / web server
disco      "public/"    / static file
fpm        "PHP-FPM"    / process manager
php        "index.php"  / front controller

navegador -> nginx : HTTPS
nginx     -> disco : file exists? | exists?
nginx     -> fpm   : FastCGI · unix socket | FastCGI
fpm       -> php   : runs`;

export const REFERENCE_STATES = `

state "GET /posts/42"
  title: Request dinâmica
  text: Não existe arquivo /posts/42 em public/, então o try_files manda para o index.php. O NGINX repassa ao PHP-FPM via FastCGI e a resposta volta pelo mesmo caminho.
  hint: try_files $uri $uri/ /index.php?$query_string;
  path navegador nginx fpm php

state "GET /css/app.css"
  title: Arquivo estático
  text: O arquivo existe em public/. O NGINX entrega direto do disco e o PHP nem fica sabendo da request.
  path navegador nginx disco

state 502
  title: Bad Gateway
  text: O NGINX tentou falar com o PHP-FPM e não conseguiu. O serviço pode estar parado, o socket pode ter outro nome ou faltar permissão.
  hint: systemctl status php8.4-fpm · ls -la /run/php/
  path navegador nginx
  nginx -> fpm broken
  fpm down

state 504
  title: Gateway Timeout
  text: O PHP-FPM recebeu a request, mas o código demorou demais. O NGINX desiste de esperar e responde com erro.
  hint: a query lenta no código · fastcgi_read_timeout
  path navegador nginx fpm
  fpm -> php slow
  php slow`;

export const REFERENCE_STATES_EN = `

state "GET /posts/42"
  title: Dynamic request
  text: There is no /posts/42 file in public/, so try_files hands over to index.php. NGINX passes it to PHP-FPM over FastCGI and the response comes back the same way.
  hint: try_files $uri $uri/ /index.php?$query_string;
  path navegador nginx fpm php

state "GET /css/app.css"
  title: Static file
  text: The file exists in public/. NGINX serves it straight from disk and PHP never hears about the request.
  path navegador nginx disco

state 502
  title: Bad Gateway
  text: NGINX tried to reach PHP-FPM and could not. The service may be stopped, the socket may have another name or a permission may be missing.
  hint: systemctl status php8.4-fpm · ls -la /run/php/
  path navegador nginx
  nginx -> fpm broken
  fpm down

state 504
  title: Gateway Timeout
  text: PHP-FPM took the request, but the code ran for too long. NGINX gives up waiting and responds with an error.
  hint: a slow query in the code · fastcgi_read_timeout
  path navegador nginx fpm
  fpm -> php slow
  php slow`;

export const REFERENCE_SPECTRUM = `spectrum extracao
title: A ordem da extração
axis: água encontra o pó -> extração completa

zone "Extração de menos" 0-38
  taste: Azedo, ralo, sem doçura
  next: Moa um pouco mais fino
zone "Ponto certo" 38-66
  taste: Doce, equilibrado
  next: Não mexa. Anote a receita
zone "Extração demais" 66-100
  taste: Amargo, seco, áspero
  next: Moa um pouco mais grosso

lane "Ácidos e frutados" 0-42
lane "Doces" 24-74
lane "Amargos e adstringentes" 58-100`;

export const REFERENCE_SPECTRUM_EN = `spectrum extracao
title: The order of extraction
axis: water meets the grounds -> full extraction

zone "Under-extracted" 0-38
  taste: Sour, thin, no sweetness
  next: Grind a little finer
zone "Just right" 38-66
  taste: Sweet, balanced
  next: Change nothing. Write the recipe down
zone "Over-extracted" 66-100
  taste: Bitter, dry, harsh
  next: Grind a little coarser

lane "Acids and fruit" 0-42
lane "Sweetness" 24-74
lane "Bitterness and astringency" 58-100`;

export const REFERENCE_SEQUENCE = `sequence fila-de-jobs
title: Um job saindo da request até o worker

app    "Aplicação" / request
fila   "Fila"      / Redis
worker "Worker"    / processo

app    -> fila   : despacha o job
fila   -> worker : entrega o job
worker -> worker : executa
worker --> fila  : confirma`;

export const REFERENCE_SEQUENCE_EN = `sequence fila-de-jobs
title: A job leaving the request for the worker

app    "Application" / request
fila   "Queue"       / Redis
worker "Worker"      / process

app    -> fila   : dispatches the job
fila   -> worker : hands over the job
worker -> worker : runs
worker --> fila  : acknowledges`;

export const REFERENCE_LAYERS = `layers ecossistema-laravel
title: O ecossistema Laravel

infra "Infraestrutura" / onde a aplicação mora
  : Forge, Vapor, Cloud, Nightwatch
  runtime "Servidor / Runtime" / quem recebe a request e roda o PHP
    : NGINX + PHP-FPM, FrankenPHP, Octane
    app "Aplicação" / o que você instala e escreve
      group "Frontend": Blade, Livewire, Inertia (React/Vue), Vite
      core "laravel/framework" / o núcleo
        : Container, Providers, Routing, Middleware, Validation,
          Eloquent, Queues, Events, Cache
      group "Pacotes": Sanctum, Horizon, Reverb, Scout, Cashier,
                       Pennant, Pulse, Telescope, AI SDK, MCP
      group "O seu código" highlight: domínio, casos de uso, integrações

base "A base de tudo": PHP 8.3+, Composer, PSRs, componentes do Symfony
aside "Desenvolvimento" / não vai para produção
  : Herd, Sail, Pint, Pest, Dusk, Boost`;

export const REFERENCE_LAYERS_EN = `layers ecossistema-laravel
title: The Laravel ecosystem

infra "Infrastructure" / where the app lives
  : Forge, Vapor, Cloud, Nightwatch
  runtime "Server / Runtime" / takes the request and runs PHP
    : NGINX + PHP-FPM, FrankenPHP, Octane
    app "Application" / what you install and write
      group "Frontend": Blade, Livewire, Inertia (React/Vue), Vite
      core "laravel/framework" / the core
        : Container, Providers, Routing, Middleware, Validation,
          Eloquent, Queues, Events, Cache
      group "Packages": Sanctum, Horizon, Reverb, Scout, Cashier,
                        Pennant, Pulse, Telescope, AI SDK, MCP
      group "Your code" highlight: domain, use cases, integrations

base "The foundation": PHP 8.3+, Composer, PSRs, Symfony components
aside "Development" / never ships to production
  : Herd, Sail, Pint, Pest, Dusk, Boost`;
