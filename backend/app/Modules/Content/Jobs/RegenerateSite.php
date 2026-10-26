<?php

declare(strict_types=1);

namespace App\Modules\Content\Jobs;

use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Process\Process;

/**
 * Regenera o site inteiro, não um slug.
 *
 * Toda publicação nova muda as duas homes, o 404, o sitemap e o índice do
 * acervo que vive dentro de cada artigo já gravado. Um caminho por slug
 * precisaria regravar quase tudo de qualquer modo, e seria um segundo caminho
 * de código divergindo do build.
 */
class RegenerateSite implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    /** Depois disto a trava cai, mesmo que o job tenha morrido sem soltar. */
    public int $uniqueFor = 300;

    public int $timeout = 180;

    /**
     * O timeout do processo é menor que o do job de propósito.
     *
     * Iguais, a corrida é entre o `Process` expirar educadamente — logando
     * stderr e o tempo decorrido — e o worker matar o PHP por cima dele. Se o
     * worker ganha, o `node` filho pode ficar orfao escrevendo em /srv/site
     * enquanto a retentativa já começou, e o log não tem nada além da exceção
     * genérica. Esta folga garante que quem expira primeiro e quem sabe
     * explicar por que.
     */
    private const PROCESS_TIMEOUT = 150;

    public function __construct()
    {
        // Colapsa a rajada de edições de quem está escrevendo no painel.
        //
        // Atribuído aqui e não como propriedade de classe porque a trait
        // Queueable já declara `$delay` (padrão nulo): o PHP 8.3 recusa
        // redeclarar, na classe, uma propriedade herdada de trait com um
        // padrão diferente ("the definition differs and is considered
        // incompatible"). Atribuir no construtor tem o mesmo efeito em tempo
        // de execução sem colidir com a trait.
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
                // O molde vem da cópia intocada assada na imagem, nunca do
                // destino: o prerender grava a home por cima de
                // <DIST>/index.html, e ler dali envenenaria a próxima passada.
                'TEMPLATE_DIR' => config('publishing.template_dir'),
                'PRERENDER_API_URL' => config('publishing.api_url'),
                'VITE_SITE_URL' => config('app.url'),
                'PRERENDER_INTERNAL_TOKEN' => config('publishing.internal_token'),
            ],
            null,
            self::PROCESS_TIMEOUT,
        );

        /*
         * O try existe porque `run()` lança antes de `isSuccessful()` em dois
         * casos que interessam: timeout e erro de infraestrutura (cwd que não
         * existe, binário ausente). Sem ele, justamente a falha mais provável
         * quando isto rodar desacompanhado seria a que sai com o pior
         * diagnóstico — a exceção genérica do Laravel, sem stderr nem tempo.
         */
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

        // O tempo vai para o log porque a spec condiciona o corte por slug a
        // ele: se a regeração completa passar de trinta segundos, o caminho
        // por slug entra. A medição mora aqui para que a decisão seja tomada
        // com número, não com palpite.
        Log::info('RegenerateSite concluido', [
            'segundos' => $seconds,
            'saida' => trim($process->getOutput()),
        ]);
    }
}
