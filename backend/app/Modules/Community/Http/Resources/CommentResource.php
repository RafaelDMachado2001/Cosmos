<?php

declare(strict_types=1);

namespace App\Modules\Community\Http\Resources;

use App\Modules\Community\Models\Comment;
use App\Modules\Identity\Contracts\PublicProfile;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Comment */
final class CommentResource extends JsonResource
{
    public function __construct(Comment $comment, private readonly ?PublicProfile $author)
    {
        parent::__construct($comment);
    }

    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'body' => $this->body,
            'createdAt' => $this->created_at->toIso8601String(),
            'author' => $this->author?->toArray(),
        ];
    }
}
