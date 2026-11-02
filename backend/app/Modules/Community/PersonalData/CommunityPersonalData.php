<?php

declare(strict_types=1);

namespace App\Modules\Community\PersonalData;

use App\Modules\Community\Models\Comment;
use App\Modules\Community\Models\Reaction;
use App\Modules\Content\Contracts\PublicationSlugs;
use App\Modules\Identity\Contracts\PersonalDataSource;

final class CommunityPersonalData implements PersonalDataSource
{
    public function __construct(private readonly PublicationSlugs $slugs) {}

    public function key(): string
    {
        return 'community';
    }

    public function export(int $memberId): array
    {
        $comments = Comment::query()->where('member_id', $memberId)->orderBy('id')->get();
        $reactions = Reaction::query()->where('member_id', $memberId)->orderBy('created_at')->get();

        $slugs = $this->slugs->forIds([
            ...$comments->pluck('publication_id')->all(),
            ...$reactions->pluck('publication_id')->all(),
        ]);

        return [
            'comments' => $comments->map(static fn (Comment $comment): array => [
                'publication' => $slugs[$comment->publication_id] ?? null,
                'locale' => $comment->locale,
                'body' => $comment->body,
                'status' => $comment->status,
                'createdAt' => $comment->created_at->toIso8601String(),
            ])->all(),
            'reactions' => $reactions->map(static fn (Reaction $reaction): array => [
                'publication' => $slugs[$reaction->publication_id] ?? null,
                'createdAt' => $reaction->created_at->toIso8601String(),
            ])->all(),
        ];
    }
}
