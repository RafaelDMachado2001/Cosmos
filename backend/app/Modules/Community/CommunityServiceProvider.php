<?php

declare(strict_types=1);

namespace App\Modules\Community;

use App\Modules\Community\Listeners\ForgetMember;
use App\Modules\Community\PersonalData\CommunityPersonalData;
use App\Modules\Identity\Contracts\PersonalDataSource;
use App\Modules\Identity\Events\MemberDeleted;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class CommunityServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Event::listen(MemberDeleted::class, ForgetMember::class);

        $this->app->tag(CommunityPersonalData::class, PersonalDataSource::TAG);

        RateLimiter::for('comments', static function (Request $request): array {
            $member = (string) $request->user('sanctum')?->getAuthIdentifier();

            return [
                Limit::perMinute(5)->by("comments:minute:{$member}"),
                Limit::perDay(30)->by("comments:day:{$member}"),
            ];
        });
    }
}
