<?php

declare(strict_types=1);

namespace App\Modules\Community\Support;

use App\Modules\Community\Models\Comment;
use App\Modules\Community\Models\Reaction;
use App\Modules\Content\Contracts\Engagement;
use App\Modules\Content\Contracts\PublicationEngagement;
use Illuminate\Database\Eloquent\Builder;

final class EngagementCounts implements PublicationEngagement
{
    public function forPublications(array $publicationIds): array
    {
        $ids = array_values(array_unique($publicationIds));
        if ($ids === []) {
            return [];
        }

        $comments = $this->countBy(Comment::query()->visible()->whereIn('publication_id', $ids));
        $reactions = $this->countBy(Reaction::query()->whereIn('publication_id', $ids));

        $engagement = [];
        foreach ($ids as $id) {
            $engagement[$id] = new Engagement(
                $comments[$id] ?? 0,
                $reactions[$id] ?? 0,
                route('filament.admin.resources.comments.index', [
                    'filters' => ['publication_id' => ['value' => (string) $id]],
                ], false),
            );
        }

        return $engagement;
    }

    /**
     * @param  Builder<Comment>|Builder<Reaction>  $query
     * @return array<int, int>
     */
    private function countBy($query): array
    {
        /** @var array<int, int> $counts */
        $counts = $query->toBase()
            ->selectRaw('publication_id, count(*) as total')
            ->groupBy('publication_id')
            ->pluck('total', 'publication_id')
            ->map(static fn (mixed $total): int => (int) $total)
            ->all();

        return $counts;
    }
}
