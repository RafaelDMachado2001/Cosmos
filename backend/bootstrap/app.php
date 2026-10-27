<?php

use App\Http\Middleware\HostBoundary;
use App\Http\Middleware\PublicCors;
use App\Http\Middleware\SecurityHeaders;
use App\Http\Middleware\VerifyEdge;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // `throttle:api` só existe no grupo porque isto o ativa; o limiter
        // 'api' e quem o define, em AppServiceProvider::boot().
        $middleware->throttleApi();
        // Sessão e CSRF nas rotas da API quando o pedido vem do site
        // (sanctum.stateful); o resto da API continua sem sessão.
        $middleware->statefulApi();
        $middleware->append(SecurityHeaders::class);
        // Fora do grupo `api` de propósito: também o 404 sem rota e o 429.
        $middleware->append(PublicCors::class);
        // Em produção, a borda é o Worker da Cloudflare: o host original chega
        // em X-Forwarded-Host. Confiar em qualquer proxy é seguro só porque
        // VerifyEdge recusa, antes, o que não veio do Worker.
        $middleware->trustProxies(
            at: '*',
            headers: Request::HEADER_X_FORWARDED_FOR | Request::HEADER_X_FORWARDED_HOST | Request::HEADER_X_FORWARDED_PROTO,
        );
        $middleware->prepend(VerifyEdge::class);
        // Global, depois do TrustProxies (getHost já lê o host da borda) e antes
        // do StartSession, que mora no grupo `web`: decide o cookie pelo host.
        $middleware->append(HostBoundary::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
