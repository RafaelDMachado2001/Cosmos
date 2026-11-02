<?php

declare(strict_types=1);

namespace App\Modules\Identity\Support;

use App\Modules\Identity\Contracts\PublicProfile;
use App\Modules\Identity\Contracts\PublicProfiles;
use App\Modules\Identity\Models\Member;

final class MemberPublicProfiles implements PublicProfiles
{
    public function forMembers(array $memberIds): array
    {
        if ($memberIds === []) {
            return [];
        }

        return Member::query()
            ->whereIn('id', array_unique($memberIds))
            ->get(['id', 'name', 'handle', 'avatar_url'])
            ->mapWithKeys(static fn (Member $member): array => [
                $member->id => new PublicProfile($member->name, $member->handle, $member->avatar_url),
            ])
            ->all();
    }
}
