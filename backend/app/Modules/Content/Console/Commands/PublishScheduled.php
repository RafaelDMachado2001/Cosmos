<?php

declare(strict_types=1);

namespace App\Modules\Content\Console\Commands;

use App\Modules\Content\Models\Publication;
use App\Modules\Content\Support\SiteRebuild;
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
        /*
         * A transição explícita que o RDM Studio pede: `publish()` marca
         * `scheduled` quando `published_at` ainda está no futuro, e é aqui
         * que ela cruza para `published`. Um `update()` por publicação, não
         * um update em massa — é o que dispara `PublicationObserver` e
         * regenera o site; um update em massa não passa pelos eventos do
         * Eloquent, e nada mais pediria a regeneração neste instante.
         */
        $transitioned = Publication::query()
            ->where('status', Publication::STATUS_SCHEDULED)
            ->where('published_at', '<=', now())
            ->get();

        foreach ($transitioned as $publication) {
            $publication->update(['status' => Publication::STATUS_PUBLISHED]);
        }

        if ($transitioned->isNotEmpty()) {
            $this->info("{$transitioned->count()} publicação(ões) agendada(s) passaram a publicada(s)");
        }

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
            SiteRebuild::request();
            $this->info("publicações agendadas: {$previous} -> {$eligible}, regeração disparada");
        }

        return self::SUCCESS;
    }
}
