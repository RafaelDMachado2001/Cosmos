<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Cabeçalhos de segurança em toda resposta que passa pelo Laravel.
 *
 * O painel não tem nenhum outro contra clickjacking — o botão único de login
 * por Google é exatamente o tipo de ação que um iframe invisível tenta
 * sequestrar. A CSP aqui é só `frame-ancestors`: o Filament e o Livewire
 * dependem de script inline. O site público recebe a política inteira do
 * Nginx (docker/web/security-headers.conf), que serve as páginas do disco sem
 * passar por aqui.
 */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $response->headers->set('X-Frame-Options', 'DENY');
        $response->headers->set('Content-Security-Policy', "frame-ancestors 'none'");
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        // Nada do backend é página para buscador: o painel, a API e o login
        // ficam fora do índice. O conteúdo indexável é o do site estático.
        $response->headers->set('X-Robots-Tag', 'noindex, nofollow');

        return $response;
    }
}
