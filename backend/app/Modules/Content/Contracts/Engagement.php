<?php

declare(strict_types=1);

namespace App\Modules\Content\Contracts;

final readonly class Engagement
{
    public function __construct(
        public int $comments,
        public int $reactions,
        public ?string $moderationUrl,
    ) {}

    public static function none(): self
    {
        return new self(0, 0, null);
    }

    /** @return array{comments: int, reactions: int, moderationUrl: string|null} */
    public function toArray(): array
    {
        return [
            'comments' => $this->comments,
            'reactions' => $this->reactions,
            'moderationUrl' => $this->moderationUrl,
        ];
    }
}
