<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Illuminate\Console\Command;

/**
 * Recusa subir o contêiner de produção mal configurado.
 *
 * Roda no entrypoint da imagem de produção (docker/production/entrypoint.sh),
 * antes de o FrankenPHP abrir a porta: uma revisão do Cloud Run que falha aqui
 * nunca passa no health check, e o tráfego fica na revisão anterior. Cada item
 * é algo que, esquecido, funciona "quase" — o pior tipo de erro de deploy.
 */
class AssertProductionEnv extends Command
{
    protected $signature = 'env:assert-production';

    protected $description = 'Falha se a configuração não serve para produção';

    public function handle(): int
    {
        $problems = self::problems();

        foreach ($problems as $problem) {
            $this->error($problem);
        }

        if ($problems === []) {
            $this->info('produção: ok');
        }

        return $problems === [] ? self::SUCCESS : self::FAILURE;
    }

    /** @return list<string> */
    public static function problems(): array
    {
        $filled = static fn (string $key): bool => is_string(config($key)) && config($key) !== '';
        $checks = [
            'APP_ENV precisa ser production' => config('app.env') === 'production',
            'APP_DEBUG precisa ser false' => config('app.debug') === false,
            'APP_KEY ausente' => $filled('app.key'),
            'APP_URL precisa ser https' => str_starts_with((string) config('app.url'), 'https://'),
            'SESSION_SECURE_COOKIE precisa ser true' => config('session.secure') === true,
            'SESSION_DOMAIN ausente' => $filled('session.domain'),
            'MEDIA_DISK precisa ser s3: o disco do contêiner some' => config('filesystems.disks.media.driver') === 's3',
            'MEDIA_S3_BUCKET ausente' => $filled('filesystems.disks.media.bucket'),
            'MEDIA_URL precisa ser https' => str_starts_with((string) config('filesystems.disks.media.url'), 'https://'),
            'SITE_REBUILD_DRIVER precisa ser vercel' => config('publishing.rebuild_driver') === 'vercel',
            'VERCEL_DEPLOY_HOOK_URL ausente' => $filled('publishing.vercel_deploy_hook'),
            'SCHEDULER_OIDC_AUDIENCE ausente' => $filled('scheduler.oidc_audience'),
            'SCHEDULER_SERVICE_ACCOUNT ausente' => $filled('scheduler.service_account'),
            'ADMIN_HOST ausente' => $filled('hosts.admin'),
            'API_HOST ausente' => $filled('hosts.api'),
        ];

        return array_keys(array_filter($checks, static fn (bool $ok): bool => ! $ok));
    }
}
