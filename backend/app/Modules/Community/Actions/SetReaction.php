<?php

declare(strict_types=1);

namespace App\Modules\Community\Actions;

use App\Modules\Community\Events\ReactionAdded;
use App\Modules\Community\Events\ReactionRemoved;
use App\Modules\Community\Models\Reaction;
use Illuminate\Support\Facades\DB;

final class SetReaction
{
    public function handle(int $memberId, int $publicationId, bool $reacted): void
    {
        DB::transaction(static function () use ($memberId, $publicationId, $reacted): void {
            $key = ['publication_id' => $publicationId, 'member_id' => $memberId];

            if ($reacted && Reaction::query()->insertOrIgnore($key) > 0) {
                ReactionAdded::dispatch($memberId, $publicationId);
            }

            if (! $reacted && Reaction::query()->where($key)->delete() > 0) {
                ReactionRemoved::dispatch($memberId, $publicationId);
            }
        });
    }
}
