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
