<?php

declare(strict_types=1);

namespace App\Modules\Identity\Contracts;

interface PublicProfiles
{
    /**
     * @param  array<int>  $memberIds
     * @return array<int, PublicProfile>
     */
    public function forMembers(array $memberIds): array;
}
