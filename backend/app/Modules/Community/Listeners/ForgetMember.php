<?php

declare(strict_types=1);

namespace App\Modules\Community\Listeners;

use App\Modules\Community\Models\Comment;
use App\Modules\Community\Models\Reaction;
use App\Modules\Identity\Events\MemberDeleted;

final class ForgetMember
{
    public function handle(MemberDeleted $event): void
    {
        Reaction::query()->where('member_id', $event->memberId)->delete();

        Comment::query()
            ->where('member_id', $event->memberId)
            ->update(['body' => null, 'status' => Comment::STATUS_DELETED]);
    }
}
