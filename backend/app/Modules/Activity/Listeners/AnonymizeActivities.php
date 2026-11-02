<?php

declare(strict_types=1);

namespace App\Modules\Activity\Listeners;

use App\Modules\Identity\Events\MemberDeleted;
use Illuminate\Support\Facades\DB;

final class AnonymizeActivities
{
    public function handle(MemberDeleted $event): void
    {
        DB::statement("SET LOCAL cosmos.anonymizing = 'on'");
        DB::table('activities')->where('member_id', $event->memberId)->update(['payload' => '{}']);
    }
}
