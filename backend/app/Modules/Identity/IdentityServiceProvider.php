<?php

declare(strict_types=1);

namespace App\Modules\Identity;

use App\Modules\Identity\Console\Commands\E2eMemberSession;
use App\Modules\Identity\Contracts\PublicProfiles;
use App\Modules\Identity\Support\MemberPublicProfiles;
use Illuminate\Support\ServiceProvider;

class IdentityServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(PublicProfiles::class, MemberPublicProfiles::class);
    }

    public function boot(): void
    {
        if ($this->app->runningInConsole()) {
            $this->commands([E2eMemberSession::class]);
        }
    }
}
