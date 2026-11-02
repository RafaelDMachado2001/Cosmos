<?php

declare(strict_types=1);

namespace App\Modules\Community\Events;

use Illuminate\Foundation\Events\Dispatchable;

final class ReactionAdded
{
    use Dispatchable;

    public function __construct(
        public readonly int $memberId,
        public readonly int $publicationId,
    ) {}
}
