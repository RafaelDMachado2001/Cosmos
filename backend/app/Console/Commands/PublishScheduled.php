<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Jobs\RegenerateSite;
use App\Models\Publication;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;

/**
 * Nota quando uma publicação agendada cruza `published_at` e manda regenerar.
 *
 * Nada dispara isso por si só: o pipeline da fase 9 só regenera quando alguém
 * salva ou apaga uma publicação (`PublicationObserver`), e uma publicação
 * agendada não recebe nenhum `save` no instante em que vira elegível. Roda a
 * cada minuto pelo `schedule:work` (serviço `scheduler` no compose).
 */
class PublishScheduled extends Command
{
    protected $signature = 'publications:publish-scheduled';

    protected $description = 'Regenera o site quando uma publicação agendada vira elegível';

    private const string CACHE_KEY = 'publications:eligible-count';

    public function handle(): int
    {
        $eligible = Publication::query()
            ->where('status', Publication::STATUS_PUBLISHED)
            ->where('published_at', '<=', now())
            ->count();

        /*
         * Comparado contra um inteiro em cache, não contra uma janela de
         * tempo: sobrevive a uma pausa do scheduler sem perder publicações —
         * quando ele volta, a contagem simplesmente subiu mais do que
         * subiria num minuto só, e o regenera único continua certo.
         *
         * Sem valor em cache ainda (primeira execução depois de um deploy), a
         * contagem atual é a própria linha de base: nada "cruzou" ainda, e
         * disparar aqui regeneraria o site a cada deploy sem motivo.
         */
        $previous = (int) Cache::get(self::CACHE_KEY, $eligible);
        Cache::forever(self::CACHE_KEY, $eligible);

        if ($eligible > $previous) {
            RegenerateSite::dispatch();
            $this->info("publicações agendadas: {$previous} -> {$eligible}, regeração disparada");
        }

        return self::SUCCESS;
    }
}
