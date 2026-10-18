<?php

declare(strict_types=1);

namespace App\Modules\Content\Jobs;

use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Process\Process;

/**
 * Regenera o site inteiro, nao um slug.
 *
 * Toda publicacao nova muda as duas homes, o 404, o sitemap e o indice do
 * acervo que vive dentro de cada artigo ja gravado. Um caminho por slug
 * precisaria regravar quase tudo de qualquer modo, e seria um segundo caminho
 * de codigo divergindo do build.
 */
class RegenerateSite implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    /** Depois disto a trava cai, mesmo que o job tenha morrido sem soltar. */
    public int $uniqueFor = 300;

    public int $timeout = 180;

    /**
     * O timeout do processo e menor que o do job de proposito.
     *
     * Iguais, a corrida e entre o `Process` expirar educadamente — logando
     * stderr e o tempo decorrido — e o worker matar o PHP por cima dele. Se o
     * worker ganha, o `node` filho pode ficar orfao escrevendo em /srv/site
     * enquanto a retentativa ja comecou, e o log nao tem nada alem da excecao
     * generica. Esta folga garante que quem expira primeiro e quem sabe
     * explicar por que.
     */
    private const PROCESS_TIMEOUT = 150;

    public function __construct()
    {
        // Colapsa a rajada de edicoes de quem esta escrevendo no painel.
        //
        // Atribuido aqui e nao como propriedade de classe porque a trait
        // Queueable ja declara `$delay` (padrao nulo): o PHP 8.3 recusa
        // redeclarar, na classe, uma propriedade herdada de trait com um
        // padrao diferente ("the definition differs and is considered
        // incompatible"). Atribuir no construtor tem o mesmo efeito em tempo
        // de execucao sem colidir com a trait.
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
                // O molde vem da copia intocada assada na imagem, nunca do
                // destino: o prerender grava a home por cima de
                // <DIST>/index.html, e ler dali envenenaria a proxima passada.
                'TEMPLATE_DIR' => config('publishing.template_dir'),
                'PRERENDER_API_URL' => config('publishing.api_url'),
                'VITE_SITE_URL' => config('app.url'),
                'PRERENDER_INTERNAL_TOKEN' => config('publishing.internal_token'),
            ],
            null,
            self::PROCESS_TIMEOUT,
        );

        /*
         * O try existe porque `run()` lanca antes de `isSuccessful()` em dois
         * casos que interessam: timeout e erro de infraestrutura (cwd que nao
         * existe, binario ausente). Sem ele, justamente a falha mais provavel
         * quando isto rodar desacompanhado seria a que sai com o pior
         * diagnostico — a excecao generica do Laravel, sem stderr nem tempo.
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
        // ele: se a regeracao completa passar de trinta segundos, o caminho
        // por slug entra. A medicao mora aqui para que a decisao seja tomada
        // com numero, nao com palpite.
        Log::info('RegenerateSite concluido', [
            'segundos' => $seconds,
            'saida' => trim($process->getOutput()),
        ]);
    }
}
