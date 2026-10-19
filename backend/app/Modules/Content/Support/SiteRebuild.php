<?php

declare(strict_types=1);

namespace App\Modules\Content\Support;

use App\Modules\Content\Jobs\RegenerateSite;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

use function Illuminate\Support\defer;

/**
 * O único caminho para "o site público precisa refletir o banco".
 *
 * Dois drivers (`publishing.rebuild_driver`):
 *
 * - `local`: o `RegenerateSite` de sempre, que roda o prerender e grava no
 *   volume do Nginx. É o do `docker compose`.
 * - `vercel`: produção. O site mora na Vercel e o build dela já lê da API;
 *   reconstruir é chamar o deploy hook. Sem worker: marca o site como sujo e
 *   tenta disparar depois da resposta. Disparo no máximo a cada
 *   `rebuild_min_interval` segundos — dez salvamentos seguidos custam um
 *   build, não dez — e o que sobrar sujo o tick do agendador leva.
 */
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

    /**
     * Dispara o hook se há mudança pendente e o intervalo mínimo passou.
     *
     * `true` só quando o hook respondeu 2xx. Falha não lança: o salvamento já
     * aconteceu, e o site continua sujo para a próxima tentativa.
     */
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

        // Dois flushes simultâneos (o defer de um request e o tick) não
        // podem disparar dois builds.
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
        // Só limpa se ninguém sujou de novo enquanto o hook respondia: o build
        // que acabou de começar pode já ter lido a API antes dessa edição.
        if (Cache::get(self::DIRTY) === $dirtyAt) {
            Cache::forget(self::DIRTY);
        }

        return true;
    }
}
