<?php

declare(strict_types=1);

namespace App\Modules\Community\Actions;

use App\Modules\Community\Models\Comment;
use LogicException;

final class SetCommentVisibility
{
    public function handle(Comment $comment, bool $visible): void
    {
        if ($comment->status === Comment::STATUS_DELETED) {
            throw new LogicException('Um comentário apagado pelo autor não volta.');
        }

        $comment->update(['status' => $visible ? Comment::STATUS_PUBLISHED : Comment::STATUS_HIDDEN]);
    }
}
