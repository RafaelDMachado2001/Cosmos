<?php

declare(strict_types=1);

namespace App\Jobs;

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
            ],
            null,
            $this->timeout,
        );

        $process->run();

        $seconds = round(microtime(true) - $started, 1);

        if (! $process->isSuccessful()) {
            Log::error('RegenerateSite falhou', [
                'saida' => $process->getErrorOutput(),
                'segundos' => $seconds,
            ]);

            throw new \RuntimeException('prerender falhou: '.$process->getErrorOutput());
        }

        // A spec poe o corte por slug em cima de trinta segundos. A medicao
        // mora aqui para que a decisao seja tomada com numero, nao com palpite.
        Log::info('RegenerateSite concluido', [
            'segundos' => $seconds,
            'saida' => trim($process->getOutput()),
        ]);
    }
}
