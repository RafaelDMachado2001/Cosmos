<?php

declare(strict_types=1);

namespace App\Modules\Content\Observers;

use App\Modules\Content\Models\Publication;
use App\Modules\Content\Support\SiteRebuild;
use Illuminate\Contracts\Events\ShouldHandleEventsAfterCommit;

/** Depois do commit: reconstruir antes disso leria o conteúdo antigo. */
class PublicationObserver implements ShouldHandleEventsAfterCommit
{
    public function saved(Publication $publication): void
    {
        SiteRebuild::request();
    }

    public function deleted(Publication $publication): void
    {
        SiteRebuild::request();
    }
}
