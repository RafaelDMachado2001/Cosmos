<?php

declare(strict_types=1);

namespace App\Observers;

use App\Jobs\RegenerateSite;
use App\Models\Publication;

/**
 * Publicar pelo painel tem de chegar ao disco.
 *
 * `saved` cobre criacao e edicao; `deleted` existe porque despublicar tambem
 * muda o site — e um artigo que sumiu do banco mas continua no disco e pior
 * que um que nunca chegou la.
 */
class PublicationObserver
{
    public function saved(Publication $publication): void
    {
        RegenerateSite::dispatch();
    }

    public function deleted(Publication $publication): void
    {
        RegenerateSite::dispatch();
    }
}
