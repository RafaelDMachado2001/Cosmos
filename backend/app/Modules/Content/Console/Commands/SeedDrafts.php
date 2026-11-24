<?php

declare(strict_types=1);

namespace App\Modules\Content\Console\Commands;

use App\Modules\Content\Models\PublicationDraft;
use App\Modules\Content\Models\PublicationTranslation;
use App\Modules\Content\Support\DraftBlocksCli;
use App\Modules\Content\Support\PublicationLock;
use Illuminate\Console\Command;

class SeedDrafts extends Command
{
    protected $signature = 'rdm-studio:seed-drafts';

    protected $description = 'Gera um rascunho do RDM Studio a partir de cada tradução já publicada';

    public function handle(): int
    {
        $translations = PublicationTranslation::all();
        $this->info("convertendo {$translations->count()} traduções...");

        foreach ($translations as $listed) {
            $translation = PublicationLock::run($listed->publication_id, function () use ($listed): ?PublicationTranslation {
                $translation = $listed->fresh();
                if ($translation === null) {
                    return null;
                }

                PublicationDraft::updateOrCreate(
                    ['publication_id' => $translation->publication_id, 'locale' => $translation->locale],
                    [
                        'title' => $translation->title,
                        'subtitle' => $translation->summary,
                        'blocks' => DraftBlocksCli::toBlocks($translation->body),
                    ],
                );

                return $translation;
            });

            if ($translation === null) {
                continue;
            }

            $this->line("  {$translation->locale}: publicação #{$translation->publication_id} ok");
        }

        return self::SUCCESS;
    }
}
