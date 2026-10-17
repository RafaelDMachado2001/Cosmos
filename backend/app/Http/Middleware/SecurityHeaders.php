<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Cabeçalhos anti-clickjacking em toda resposta que passa pelo Laravel.
 *
 * O painel não tem nenhum outro contra isto — o botão único de login por
 * Google é exatamente o tipo de ação que um iframe invisível tenta sequestrar.
 * O site público não precisa: é servido pelo Nginx direto do disco, sem
 * passar por aqui.
 */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $response->headers->set('X-Frame-Options', 'DENY');
        $response->headers->set('Content-Security-Policy', "frame-ancestors 'none'");

        return $response;
    }
}
