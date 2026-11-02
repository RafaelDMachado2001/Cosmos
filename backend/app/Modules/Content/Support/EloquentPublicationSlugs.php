<?php

declare(strict_types=1);

namespace App\Modules\Content\Support;

use App\Modules\Content\Contracts\PublicationSlugs;
use App\Modules\Content\Models\Publication;

final class EloquentPublicationSlugs implements PublicationSlugs
{
    public function forIds(array $publicationIds): array
    {
        if ($publicationIds === []) {
            return [];
        }

        /** @var array<int, string> */
        return Publication::query()->whereIn('id', array_unique($publicationIds))->pluck('slug', 'id')->all();
    }
}
