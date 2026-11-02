<?php

declare(strict_types=1);

namespace App\Modules\Content\Support;

use App\Modules\Content\Models\Publication;
use Illuminate\Support\Facades\Cache;

final class ScheduledPublisher
{
    private const string CACHE_KEY = 'publications:eligible-count';

    /** @return array{transitioned: int, previous: int, eligible: int} */
    public static function run(): array
    {
        $transitioned = Publication::query()
            ->where('status', Publication::STATUS_SCHEDULED)
            ->where('published_at', '<=', now())
            ->get();

        foreach ($transitioned as $publication) {
            $publication->update(['status' => Publication::STATUS_PUBLISHED]);
        }

        $eligible = Publication::query()
            ->where('status', Publication::STATUS_PUBLISHED)
            ->where('published_at', '<=', now())
            ->count();

        $previous = (int) Cache::get(self::CACHE_KEY, $eligible);
        Cache::forever(self::CACHE_KEY, $eligible);

        if ($eligible > $previous) {
            SiteRebuild::request();
        }

        return ['transitioned' => $transitioned->count(), 'previous' => $previous, 'eligible' => $eligible];
    }
}
