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
