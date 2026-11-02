<?php

declare(strict_types=1);

namespace App\Modules\Identity\Contracts;

interface PersonalDataSource
{
    public const TAG = 'identity.personal-data';

    public function key(): string;

    /** @return array<int|string, mixed> */
    public function export(int $memberId): array;
}
