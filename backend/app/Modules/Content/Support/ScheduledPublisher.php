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
        $due = Publication::query()
            ->where('status', Publication::STATUS_SCHEDULED)
            ->where('published_at', '<=', now())
            ->pluck('id');

        $transitioned = 0;
        foreach ($due as $id) {
            $changed = PublicationLock::run((int) $id, function (Publication $publication): bool {
                // Enquanto esperava o lock, alguém pode ter despublicado ou adiado.
                if ($publication->status !== Publication::STATUS_SCHEDULED || $publication->published_at->isFuture()) {
                    return false;
                }

                return $publication->update(['status' => Publication::STATUS_PUBLISHED]);
            });
            $transitioned += $changed === true ? 1 : 0;
        }

        $eligible = Publication::query()->live()->count();

        $previous = (int) Cache::get(self::CACHE_KEY, $eligible);
        Cache::forever(self::CACHE_KEY, $eligible);

        if ($eligible > $previous) {
            SiteRebuild::request();
        }

        return ['transitioned' => $transitioned, 'previous' => $previous, 'eligible' => $eligible];
    }
}
