<?php

declare(strict_types=1);

namespace App\Modules\Activity\Listeners;

use App\Modules\Activity\Models\Activity;
use App\Modules\Identity\Events\MemberRegistered;

/** A primeira atividade de toda conta. */
final class RecordMemberRegistered
{
    public function handle(MemberRegistered $event): void
    {
        Activity::record($event->memberId, 'member.registered', 'member', $event->memberId, [
            'provider' => $event->provider,
        ]);
    }
}
