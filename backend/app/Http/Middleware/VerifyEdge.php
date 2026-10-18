<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Só a borda da Cloudflare fala com o contêiner.
 *
 * Em produção o Worker (infra/cloudflare/edge-worker.js) é quem recebe
 * api. e admin. e repassa à URL *.run.app, com o host original em
 * X-Forwarded-Host e este segredo em X-Edge-Secret. Sem o segredo, 404 — o
 * run.app não é uma porta dos fundos, e os cabeçalhos X-Forwarded-* em que o
 * TrustProxies confia só podem ter vindo do Worker. `/up` fica aberto: é o
 * health check do Cloud Run, que não passa pela borda.
 */
class VerifyEdge
{
    public function handle(Request $request, Closure $next): Response
    {
        $secret = config('hosts.edge_secret');

        if (is_string($secret) && $secret !== '' && ! $request->is('up')) {
            $given = $request->header('X-Edge-Secret');
            abort_unless(is_string($given) && hash_equals($secret, $given), 404);
        }

        return $next($request);
    }
}
