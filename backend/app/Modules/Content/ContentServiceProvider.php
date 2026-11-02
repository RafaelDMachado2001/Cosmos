<?php

declare(strict_types=1);

namespace App\Modules\Content;

use App\Modules\Content\Console\Commands\MigrateMediaToBucket;
use App\Modules\Content\Console\Commands\PublishScheduled;
use App\Modules\Content\Console\Commands\SeedDrafts;
use App\Modules\Content\Contracts\PublishedPublications;
use App\Modules\Content\Models\Publication;
use App\Modules\Content\Models\PublicationTranslation;
use App\Modules\Content\Observers\PublicationObserver;
use App\Modules\Content\Support\LivePublications;
use App\Modules\Content\Support\SiteRebuild;
use Illuminate\Support\ServiceProvider;

class ContentServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(PublishedPublications::class, LivePublications::class);
    }

    public function boot(): void
    {
        Publication::observe(PublicationObserver::class);

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
