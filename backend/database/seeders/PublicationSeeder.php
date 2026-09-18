<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Publication;
use Illuminate\Database\Seeder;

/**
 * O acervo semente.
 *
 * O JSON ao lado é gerado de `src/data/publications.ts` por
 * `npm run emit:seed` — o mesmo conteúdo que a constelação usa quando não há
 * API configurada. Duas cópias escritas à mão divergiriam no primeiro ajuste de
 * texto, e a paridade entre as duas fontes é o que torna a troca de adapter
 * invisível.
 */
class PublicationSeeder extends Seeder
{
    public function run(): void
    {
        $path = database_path('seeders/publications.json');
        $rows = json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);

        foreach ($rows as $row) {
            $publication = Publication::updateOrCreate(
                ['slug' => $row['slug']],
                [
                    'category' => $row['category'],
                    'published_at' => $row['published_at'],
                    'featured' => $row['featured'],
                    'status' => Publication::STATUS_PUBLISHED,
                ]
            );

            foreach ($row['translations'] as $translation) {
                $publication->translations()->updateOrCreate(
                    ['locale' => $translation['locale']],
                    [
                        'title' => $translation['title'],
                        'summary' => $translation['summary'],
                        'body' => $translation['body'],
                    ]
                );
            }
        }
    }
}
