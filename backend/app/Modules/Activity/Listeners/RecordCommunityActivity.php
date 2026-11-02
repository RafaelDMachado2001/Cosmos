<?php

declare(strict_types=1);

namespace App\Modules\Activity\Listeners;

use App\Modules\Activity\Models\Activity;
use App\Modules\Community\Events\CommentDeleted;
use App\Modules\Community\Events\CommentPosted;
use App\Modules\Community\Events\ReactionAdded;
use App\Modules\Community\Events\ReactionRemoved;

final class RecordCommunityActivity
{
    public function commentPosted(CommentPosted $event): void
    {
        Activity::record($event->memberId, 'comment.posted', 'comment', $event->commentId, ['publication' => $event->publicationId]);
    }

    public function commentDeleted(CommentDeleted $event): void
    {
        Activity::record($event->memberId, 'comment.deleted', 'comment', $event->commentId, ['publication' => $event->publicationId]);
    }

    public function reactionAdded(ReactionAdded $event): void
    {
        Activity::record($event->memberId, 'reaction.added', 'publication', $event->publicationId);
    }

    public function reactionRemoved(ReactionRemoved $event): void
    {
        Activity::record($event->memberId, 'reaction.removed', 'publication', $event->publicationId);
    }

    /** @return array<class-string, string> */
    public function subscribe(): array
    {
        return [
            CommentPosted::class => 'commentPosted',
            CommentDeleted::class => 'commentDeleted',
            ReactionAdded::class => 'reactionAdded',
            ReactionRemoved::class => 'reactionRemoved',
        ];
    }
}
