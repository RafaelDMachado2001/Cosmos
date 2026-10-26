<?php

declare(strict_types=1);

namespace App\Modules\Content\Observers;

use App\Modules\Content\Models\Publication;
use App\Modules\Content\Support\SiteRebuild;

/**
 * Publicar pelo painel tem de chegar ao disco.
 *
 * `saved` cobre criação e edição; `deleted` existe porque despublicar também
 * muda o site — e um artigo que sumiu do banco mas continua no disco e pior
 * que um que nunca chegou lá.
 */
class PublicationObserver
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
