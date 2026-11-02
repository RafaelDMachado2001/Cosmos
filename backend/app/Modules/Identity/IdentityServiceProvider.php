<?php

declare(strict_types=1);

namespace App\Modules\Identity;

use App\Modules\Identity\Console\Commands\E2eMemberSession;
use Illuminate\Support\ServiceProvider;

class IdentityServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        if ($this->app->runningInConsole()) {
            $this->commands([E2eMemberSession::class]);
        }
    }
}
