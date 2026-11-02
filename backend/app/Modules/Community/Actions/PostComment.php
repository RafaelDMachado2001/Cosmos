<?php

declare(strict_types=1);

namespace App\Modules\Community\Actions;

use App\Modules\Community\Events\CommentPosted;
use App\Modules\Community\Models\Comment;
use App\Modules\Community\Support\CommentBody;
use Illuminate\Support\Facades\DB;

final class PostComment
{
    public function handle(int $memberId, int $publicationId, string $locale, string $body): Comment
    {
        return DB::transaction(static function () use ($memberId, $publicationId, $locale, $body): Comment {
            $comment = Comment::create([
                'publication_id' => $publicationId,
                'member_id' => $memberId,
                'locale' => $locale,
                'body' => CommentBody::normalize($body),
                'status' => Comment::STATUS_PUBLISHED,
            ]);

            CommentPosted::dispatch($comment->id, $memberId, $publicationId);

            return $comment;
        });
    }
}
