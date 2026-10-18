<?php

declare(strict_types=1);

namespace App\Modules\Activity\PersonalData;

use App\Modules\Activity\Models\Activity;
use App\Modules\Identity\Contracts\PersonalDataSource;

/** As atividades do membro, no export dos dados dele. */
final class ActivityPersonalData implements PersonalDataSource
{
    public function key(): string
    {
        return 'activities';
    }

    public function export(int $memberId): array
    {
        return Activity::query()
            ->where('member_id', $memberId)
            ->orderBy('occurred_at')
            ->get()
            ->map(static fn (Activity $activity): array => [
                'verb' => $activity->verb,
                'subject' => $activity->subject_type === null ? null : ['type' => $activity->subject_type, 'id' => $activity->subject_id],
                'payload' => $activity->payload,
                'occurredAt' => $activity->occurred_at->toIso8601String(),
            ])
            ->all();
    }
}
