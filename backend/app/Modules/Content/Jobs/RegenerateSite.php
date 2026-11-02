<?php

declare(strict_types=1);

namespace App\Modules\Content\Jobs;

use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Process\Process;

class RegenerateSite implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $uniqueFor = 300;

    public int $timeout = 180;

    private const PROCESS_TIMEOUT = 150;

    public function __construct()
    {
        $this->delay = 5;
    }

    public function handle(): void
    {
        $started = microtime(true);

        $process = new Process(
            ['node', 'dist-ssr/prerender.js'],
            '/srv/render',
            [
                'DIST' => config('publishing.site_dir'),
                'TEMPLATE_DIR' => config('publishing.template_dir'),
                'PRERENDER_API_URL' => config('publishing.api_url'),
                'VITE_SITE_URL' => config('app.url'),
                'PRERENDER_INTERNAL_TOKEN' => config('publishing.internal_token'),
            ],
            null,
            self::PROCESS_TIMEOUT,
        );

        try {
            $process->run();
        } catch (\Throwable $exception) {
            Log::error('RegenerateSite nao chegou a terminar', [
                'motivo' => $exception->getMessage(),
                'saida' => $process->getErrorOutput(),
                'segundos' => round(microtime(true) - $started, 1),
            ]);

            throw $exception;
        }

        $seconds = round(microtime(true) - $started, 1);

        if (! $process->isSuccessful()) {
            Log::error('RegenerateSite falhou', [
                'saida' => $process->getErrorOutput(),
                'segundos' => $seconds,
            ]);

            throw new \RuntimeException('prerender falhou: '.$process->getErrorOutput());
        }

        Log::info('RegenerateSite concluido', [
            'segundos' => $seconds,
            'saida' => trim($process->getOutput()),
        ]);
    }
}
