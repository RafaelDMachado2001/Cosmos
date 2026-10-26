<?php

declare(strict_types=1);

namespace App\Modules\Content;

use App\Modules\Content\Console\Commands\MigrateMediaToBucket;
use App\Modules\Content\Console\Commands\PublishScheduled;
use App\Modules\Content\Console\Commands\SeedDrafts;
use App\Modules\Content\Models\Publication;
use App\Modules\Content\Models\PublicationTranslation;
use App\Modules\Content\Observers\PublicationObserver;
use App\Modules\Content\Support\SiteRebuild;
use Illuminate\Support\ServiceProvider;

/**
 * O módulo de conteúdo: publicações, rascunhos, mídia e o RDM Studio.
 *
 * O Laravel só descobre sozinho os comandos de app/Console/Commands; os do
 * módulo entram por aqui.
 */
class ContentServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Publication::observe(PublicationObserver::class);

        // A tradução não passa pelo observer de Publication: salvar só o
        // texto, sem tocar na publicação, não dispara `saved` nela.
        PublicationTranslation::saved(static fn () => SiteRebuild::request());
        PublicationTranslation::deleted(static fn () => SiteRebuild::request());

        if ($this->app->runningInConsole()) {
            $this->commands([
                MigrateMediaToBucket::class,
                PublishScheduled::class,
                SeedDrafts::class,
            ]);
        }
    }
}
