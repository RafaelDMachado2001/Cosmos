<?php

declare(strict_types=1);

namespace App\Modules\Community;

use App\Modules\Community\Listeners\ForgetMember;
use App\Modules\Community\PersonalData\CommunityPersonalData;
use App\Modules\Identity\Contracts\PersonalDataSource;
use App\Modules\Identity\Events\MemberDeleted;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;

class CommunityServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Event::listen(MemberDeleted::class, ForgetMember::class);

        $this->app->tag(CommunityPersonalData::class, PersonalDataSource::TAG);
    }
}
