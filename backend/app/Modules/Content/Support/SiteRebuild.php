<?php

declare(strict_types=1);

namespace App\Modules\Content\Support;

use App\Modules\Content\Jobs\RegenerateSite;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

use function Illuminate\Support\defer;

final class SiteRebuild
{
    private const string DIRTY = 'site-rebuild:dirty-at';

    private const string FIRED = 'site-rebuild:fired-at';

    public static function request(): void
    {
        if (config('publishing.rebuild_driver') !== 'vercel') {
            RegenerateSite::dispatch();

            return;
        }

        Cache::forever(self::DIRTY, microtime(true));
        defer(static fn () => self::flush(), 'site-rebuild');
    }

    public static function flush(): bool
    {
        if (config('publishing.rebuild_driver') !== 'vercel') {
            return false;
        }

        $dirtyAt = Cache::get(self::DIRTY);
        if ($dirtyAt === null) {
            return false;
        }

        $firedAt = Cache::get(self::FIRED);
        $interval = (int) config('publishing.rebuild_min_interval');
        if ($firedAt !== null && now()->getTimestamp() - (int) $firedAt < $interval) {
            return false;
        }

        $lock = Cache::lock('site-rebuild:lock', 30);
        if (! $lock->get()) {
            return false;
        }

        try {
            $response = Http::timeout(10)->post((string) config('publishing.vercel_deploy_hook'));
            if (! $response->successful()) {
                Log::warning('deploy hook da Vercel respondeu '.$response->status());

                return false;
            }
        } catch (Throwable $error) {
            Log::warning('deploy hook da Vercel falhou: '.$error->getMessage());

            return false;
        } finally {
            $lock->release();
        }

        Cache::forever(self::FIRED, now()->getTimestamp());
        if (Cache::get(self::DIRTY) === $dirtyAt) {
            Cache::forget(self::DIRTY);
        }

        return true;
    }
}
