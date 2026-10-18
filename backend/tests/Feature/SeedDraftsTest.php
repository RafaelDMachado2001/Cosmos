<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Modules\Content\Models\Publication;
use App\Modules\Content\Models\PublicationDraft;
use Database\Seeders\PublicationSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SeedDraftsTest extends TestCase
{
    use RefreshDatabase;

    private function publish(string $slug, array $pt, array $en): Publication
    {
        $publication = Publication::create([
            'slug' => $slug,
            'category' => 'artigo',
            'published_at' => now(),
            'featured' => false,
            'status' => Publication::STATUS_PUBLISHED,
        ]);

        foreach (['pt' => $pt, 'en' => $en] as $locale => $content) {
            $publication->translations()->create([
                'locale' => $locale,
                'title' => $content[0],
                'summary' => $content[1],
                'body' => $content[2],
            ]);
        }

        return $publication;
    }

    public function test_gera_um_rascunho_por_traducao_com_titulo_subtitulo_e_blocos(): void
    {
        $publication = $this->publish(
            'teste-de-seed',
            ['Título PT', 'Subtítulo PT', "## Intertítulo\n\nUm **parágrafo**."],
            ['Title EN', 'Subtitle EN', "## Heading\n\nA **paragraph**."],
        );

        $this->artisan('rdm-studio:seed-drafts')->assertSuccessful();

        $pt = PublicationDraft::where('publication_id', $publication->id)->where('locale', 'pt')->first();
        $this->assertNotNull($pt);
        $this->assertSame('Título PT', $pt->title);
        $this->assertSame('Subtítulo PT', $pt->subtitle);
        $this->assertEquals(
            [
                ['id' => 'b0', 'type' => 'h2', 'text' => 'Intertítulo'],
                ['id' => 'b1', 'type' => 'p', 'text' => 'Um **parágrafo**.'],
            ],
            $pt->blocks,
        );

        $en = PublicationDraft::where('publication_id', $publication->id)->where('locale', 'en')->first();
        $this->assertNotNull($en);
        $this->assertSame('Title EN', $en->title);
    }

    public function test_e_idempotente_nao_duplica_ao_rodar_de_novo(): void
    {
        $this->publish('teste-idempotente', ['T', 'S', 'Corpo.'], ['T', 'S', 'Body.']);

        $this->artisan('rdm-studio:seed-drafts')->assertSuccessful();
        $this->artisan('rdm-studio:seed-drafts')->assertSuccessful();

        $this->assertSame(2, PublicationDraft::count());
    }

    public function test_converte_o_acervo_semente_inteiro_sem_erros(): void
    {
        $this->seed(PublicationSeeder::class);

        $this->artisan('rdm-studio:seed-drafts')->assertSuccessful();

        $translationCount = Publication::query()->withCount('translations')->get()->sum('translations_count');
        $this->assertSame($translationCount, PublicationDraft::count());
        $this->assertTrue(PublicationDraft::query()->whereJsonLength('blocks', '>', 0)->count() > 0);
    }
}
