<?php

declare(strict_types=1);

namespace App\Modules\Identity\Events;

use Illuminate\Foundation\Events\Dispatchable;

final class MemberDeleted
{
    use Dispatchable;

    public function __construct(
        public readonly int $memberId,
    ) {}
}
