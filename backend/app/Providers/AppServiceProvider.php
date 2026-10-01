<?php

namespace App\Providers;

use App\Jobs\RegenerateSite;
use App\Models\Publication;
use App\Models\PublicationTranslation;
use App\Observers\PublicationObserver;
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
        PublicationTranslation::saved(static fn () => RegenerateSite::dispatch());
        PublicationTranslation::deleted(static fn () => RegenerateSite::dispatch());
    }
}
