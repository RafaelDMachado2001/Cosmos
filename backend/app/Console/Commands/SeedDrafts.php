<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\PublicationDraft;
use App\Models\PublicationTranslation;
use App\Support\DraftBlocksCli;
use Illuminate\Console\Command;

/**
 * Preenche `publication_drafts` a partir do que já está publicado.
 *
 * Roda uma vez, ao introduzir o RDM Studio: sem isto, toda publicação
 * existente abriria o editor em branco, obrigando reescrever o acervo
 * inteiro à mão. Idempotente — `updateOrCreate` por `(publication_id,
 * locale)` — então rodar de novo sobre um rascunho já editado o sobrescreve
 * com o conteúdo publicado atual, não com o que foi migrado da primeira vez.
 */
class SeedDrafts extends Command
{
    protected $signature = 'rdm-studio:seed-drafts';

    protected $description = 'Gera um rascunho do RDM Studio a partir de cada tradução já publicada';

    public function handle(): int
    {
        $translations = PublicationTranslation::all();
        $this->info("convertendo {$translations->count()} traduções...");

        foreach ($translations as $translation) {
            $blocks = DraftBlocksCli::toBlocks($translation->body);

            PublicationDraft::updateOrCreate(
                ['publication_id' => $translation->publication_id, 'locale' => $translation->locale],
                [
                    'title' => $translation->title,
                    'subtitle' => $translation->summary,
                    'blocks' => $blocks,
                ],
            );

            $this->line("  {$translation->locale}: publicação #{$translation->publication_id} ok");
        }

        return self::SUCCESS;
    }
}
