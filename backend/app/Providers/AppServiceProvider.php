<?php

namespace App\Providers;

use App\Models\Publication;
use App\Models\PublicationTranslation;
use App\Observers\PublicationObserver;
use App\Support\SiteRebuild;
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
        Publication::observe(PublicationObserver::class);

        // A traducao nao passa pelo observer de Publication: salvar so o
        // texto, sem tocar na publicacao, nao dispara `saved` nela.
        PublicationTranslation::saved(static fn () => SiteRebuild::request());
        PublicationTranslation::deleted(static fn () => SiteRebuild::request());

        // O grupo `api` so aplica `throttle:api` porque bootstrap/app.php
        // chama throttleApi() — sem este limiter registrado, a primeira
        // requisicao lancaria "Rate limiter [api] is not defined".
        RateLimiter::for('api', static function (Request $request): Limit {
            $token = config('publishing.internal_token');

            // O prerender regenera o site inteiro a cada publicacao/edicao —
            // dezenas de chamadas numa unica passada, crescendo com o acervo.
            // E trafego de sistema, nao de cliente publico, e o segredo que o
            // identifica nunca sai do bundle de servidor (ver
            // src/prerender/main.ts): so o navegador nao tem como declarar.
            if (is_string($token) && $token !== '' && hash_equals($token, (string) $request->header('X-Internal-Token'))) {
                return Limit::none();
            }

            return Limit::perMinute(60)->by($request->ip());
        });
    }
}
