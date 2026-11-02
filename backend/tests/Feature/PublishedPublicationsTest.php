<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Modules\Content\Contracts\PublishedPublications;
use App\Modules\Content\Models\Publication;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublishedPublicationsTest extends TestCase
{
    use RefreshDatabase;

    private function create(string $slug, string $status, string $publishedAt, array $locales = ['pt']): Publication
    {
        $publication = Publication::create([
            'slug' => $slug,
            'category' => 'artigo',
            'published_at' => $publishedAt,
            'featured' => false,
            'status' => $status,
        ]);

        foreach ($locales as $locale) {
            $publication->translations()->create([
                'locale' => $locale,
                'title' => "Título {$slug}",
                'summary' => 'Resumo',
                'body' => 'Corpo',
            ]);
        }

        return $publication;
    }

    private function published(): PublishedPublications
    {
        return $this->app->make(PublishedPublications::class);
    }

    public function test_devolve_o_id_de_uma_publicacao_no_ar_no_idioma_pedido(): void
    {
        $publication = $this->create('no-ar', Publication::STATUS_PUBLISHED, now()->subDay()->toIso8601String());

        $this->assertSame($publication->id, $this->published()->idFor('no-ar', 'pt'));
    }

    public function test_sem_traducao_no_idioma_nao_ha_publicacao(): void
    {
        $this->create('so-em-portugues', Publication::STATUS_PUBLISHED, now()->subDay()->toIso8601String());

        $this->assertNull($this->published()->idFor('so-em-portugues', 'en'));
    }

    public function test_rascunho_agendada_e_slug_inexistente_nao_estao_no_ar(): void
    {
        $this->create('rascunho', Publication::STATUS_DRAFT, now()->subDay()->toIso8601String());
        $this->create('agendada', Publication::STATUS_SCHEDULED, now()->addDay()->toIso8601String());
        $this->create('data-futura', Publication::STATUS_PUBLISHED, now()->addDay()->toIso8601String());

        $this->assertNull($this->published()->idFor('rascunho', 'pt'));
        $this->assertNull($this->published()->idFor('agendada', 'pt'));
        $this->assertNull($this->published()->idFor('data-futura', 'pt'));
        $this->assertNull($this->published()->idFor('nao-existe', 'pt'));
    }
}
