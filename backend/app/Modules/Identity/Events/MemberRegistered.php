<?php

declare(strict_types=1);

namespace App\Modules\Identity\Events;

use Illuminate\Foundation\Events\Dispatchable;

/** Uma conta de leitor nova, criada pelo primeiro login social. */
final class MemberRegistered
{
    use Dispatchable;

    public function __construct(
        public readonly int $memberId,
        public readonly string $provider,
    ) {}
}
