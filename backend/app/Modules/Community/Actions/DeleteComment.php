<?php

declare(strict_types=1);

namespace App\Modules\Community\Actions;

use App\Modules\Community\Events\CommentDeleted;
use App\Modules\Community\Models\Comment;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;

final class DeleteComment
{
    public function handle(Comment $comment, int $memberId): void
    {
        if ($comment->member_id !== $memberId) {
            throw new AuthorizationException;
        }

        DB::transaction(static function () use ($comment): void {
            $comment->update(['body' => null, 'status' => Comment::STATUS_DELETED]);

            CommentDeleted::dispatch($comment->id, $comment->member_id, $comment->publication_id);
        });
    }
}
