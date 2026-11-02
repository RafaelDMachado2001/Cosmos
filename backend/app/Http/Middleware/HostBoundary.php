<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Session\SessionManager;
use Symfony\Component\HttpFoundation\Response;

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
            $this->session(['session.cookie' => 'rdm_admin', 'session.domain' => null]);

            return $next($request);
        }

        if ($host === $api && $request->is('api/*', 'auth/*')) {
            $this->session(['session.cookie' => 'rdm_session']);

            return $next($request);
        }

        abort(404);
    }

    /**
     * @param  array<string, mixed>  $config
     */
    private function session(array $config): void
    {
        config($config);
        app(SessionManager::class)->forgetDrivers();
    }
}
