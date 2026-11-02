<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Modules\Content\Models\Publication;
use Illuminate\Database\Seeder;

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
