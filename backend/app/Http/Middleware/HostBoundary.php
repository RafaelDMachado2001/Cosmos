<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Uma aplicação, dois hosts, duas sessões.
 *
 * O painel responde só em `hosts.admin`, com um cookie de sessão próprio e
 * sem `Domain` — fica preso ao host. A API responde só em `hosts.api`. Na
 * etapa 2 a sessão do leitor vai para o domínio do site; se o cookie do admin
 * fosse o mesmo, viajaria em toda requisição ao host do site estático, que é
 * infraestrutura de terceiro.
 *
 * Roda antes de tudo (prepend global): a configuração da sessão precisa estar
 * certa antes de o StartSession ler o cookie. `/up` responde em qualquer host
 * — é o health check do Cloud Run, que chega pela URL *.run.app.
 */
class HostBoundary
{
    public function handle(Request $request, Closure $next): Response
    {
        $admin = config('hosts.admin');
        $api = config('hosts.api');

        if (! is_string($admin) || $admin === '' || ! is_string($api) || $api === '' || $request->is('up')) {
            return $next($request);
        }

        $host = $request->getHost();

        if ($host === $admin && $request->is('admin', 'admin/*', 'livewire*', 'filament/*')) {
            config([
                'session.cookie' => 'rdm_admin',
                'session.domain' => null,
            ]);

            return $next($request);
        }

        if ($host === $api && $request->is('api/*')) {
            config(['session.cookie' => 'rdm_session']);

            return $next($request);
        }

        abort(404);
    }
}
