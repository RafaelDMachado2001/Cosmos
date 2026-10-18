<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * A leitura pública da API, aberta a qualquer origem e sem credencial.
 *
 * O HandleCors do Laravel tem uma configuração só, e ela agora é a da sessão
 * do leitor (config/cors.php): credenciais e a origem exata do site. Uma
 * origem `*` com credenciais faria o pacote refletir qualquer origem — e
 * qualquer site leria o perfil de quem está logado. Por isso as duas
 * políticas são separadas, e esta só vale para GET simples, sem preflight.
 */
class PublicCors
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $response->headers->set('Access-Control-Allow-Origin', '*');

        return $response;
    }
}
