<?php

declare(strict_types=1);

namespace App\Modules\Community\Events;

use Illuminate\Foundation\Events\Dispatchable;

final class CommentDeleted
{
    use Dispatchable;

    public function __construct(
        public readonly int $commentId,
        public readonly int $memberId,
        public readonly int $publicationId,
    ) {}
}
