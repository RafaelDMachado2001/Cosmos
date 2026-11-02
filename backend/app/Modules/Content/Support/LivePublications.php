<?php

declare(strict_types=1);

namespace App\Modules\Content\Support;

use App\Modules\Content\Contracts\PublishedPublications;
use App\Modules\Content\Models\Publication;
use Illuminate\Database\Eloquent\Builder;

class LivePublications implements PublishedPublications
{
    public function idFor(string $slug, string $locale): ?int
    {
        $id = Publication::query()
            ->live()
            ->where('slug', $slug)
            ->whereHas('translations', static fn (Builder $query) => $query->where('locale', $locale))
            ->value('id');

        return $id === null ? null : (int) $id;
    }
}
