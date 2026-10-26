<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // O grupo `api` só aplica `throttle:api` porque bootstrap/app.php
        // chama throttleApi() — sem este limiter registrado, a primeira
        // requisição lançaria "Rate limiter [api] is not defined".
        RateLimiter::for('api', static function (Request $request): Limit {
            $token = config('publishing.internal_token');

            // O prerender regenera o site inteiro a cada publicação/edição —
            // dezenas de chamadas numa única passada, crescendo com o acervo.
            // É tráfego de sistema, não de cliente público, e o segredo que o
            // identifica nunca sai do bundle de servidor (ver
            // src/prerender/main.ts): só o navegador não tem como declarar.
            if (is_string($token) && $token !== '' && hash_equals($token, (string) $request->header('X-Internal-Token'))) {
                return Limit::none();
            }

            return Limit::perMinute(60)->by($request->ip());
        });
    }
}
