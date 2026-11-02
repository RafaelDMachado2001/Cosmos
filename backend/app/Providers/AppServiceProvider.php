<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        RateLimiter::for('api', static function (Request $request): Limit {
            $token = config('publishing.internal_token');

            if (is_string($token) && $token !== '' && hash_equals($token, (string) $request->header('X-Internal-Token'))) {
                return Limit::none();
            }

            return Limit::perMinute(60)->by($request->ip());
        });
    }
}
