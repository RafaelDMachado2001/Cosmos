<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Modules\Content\Jobs\RegenerateSite;
use App\Modules\Content\Models\Publication;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class RegenerateSiteTest extends TestCase
{
    use RefreshDatabase;

    public function test_salvar_uma_publicacao_enfileira_a_regeracao(): void
    {
        Queue::fake();

        Publication::create([
            'slug' => 'publicacao-de-teste',
            'category' => 'artigo',
            'published_at' => now(),
            'featured' => false,
            'status' => Publication::STATUS_PUBLISHED,
        ]);

        Queue::assertPushed(RegenerateSite::class);
    }

    public function test_uma_rajada_de_edicoes_colapsa_num_job_so(): void
    {
        Queue::fake();

        $publication = Publication::create([
            'slug' => 'publicacao-editada',
            'category' => 'artigo',
            'published_at' => now(),
            'featured' => false,
            'status' => Publication::STATUS_DRAFT,
        ]);
        $publication->update(['status' => Publication::STATUS_PUBLISHED]);
        $publication->update(['featured' => true]);

        // Três escritas, um job. É o mecanismo central da fase: quem está
        // escrevendo no painel salva várias vezes seguidas, e cada salvamento
        // custaria um prerender de um minuto se ShouldBeUnique não colapsasse
        // a rajada. Não libere a trava aqui — liberar apaga justamente a prova.
        Queue::assertPushed(RegenerateSite::class, 1);
    }

    public function test_o_observer_dispara_em_toda_escrita_e_nao_so_na_criacao(): void
    {
        $queue = Queue::fake();

        $publication = Publication::create([
            'slug' => 'publicacao-reeditada',
            'category' => 'artigo',
            'published_at' => now(),
            'featured' => false,
            'status' => Publication::STATUS_DRAFT,
        ]);
        // A trava é liberada de propósito: aqui o que se mede é o observer, não
        // a deduplicação. O teste acima é quem cobre a deduplicação.
        $queue->releaseUniqueJobLocks();
        $publication->update(['status' => Publication::STATUS_PUBLISHED]);
        $queue->releaseUniqueJobLocks();
        $publication->update(['featured' => true]);

        Queue::assertPushed(RegenerateSite::class, 3);
    }

    public function test_apagar_uma_publicacao_tambem_regenera(): void
    {
        $publication = Publication::create([
            'slug' => 'publicacao-apagada',
            'category' => 'artigo',
            'published_at' => now(),
            'featured' => false,
            'status' => Publication::STATUS_PUBLISHED,
        ]);

        // Depois da criação: interessa o dispatch do delete, não o dela.
        $queue = Queue::fake();
        $publication->delete();

        Queue::assertPushed(RegenerateSite::class);
    }

    public function test_editar_so_a_traducao_tambem_regenera(): void
    {
        $publication = Publication::create([
            'slug' => 'publicacao-traduzida',
            'category' => 'artigo',
            'published_at' => now(),
            'featured' => false,
            'status' => Publication::STATUS_PUBLISHED,
        ]);
        $translation = $publication->translations()->create([
            'locale' => 'pt',
            'title' => 'Titulo original',
            'summary' => 'Resumo.',
            'body' => 'Texto.',
        ]);

        // Um ajuste de título não encosta na linha de `publications`, então só
        // o observer de PublicationTranslation o pega. É a metade menos óbvia
        // da fiação, e a que regride em silêncio.
        $queue = Queue::fake();
        $translation->update(['title' => 'Titulo corrigido']);

        Queue::assertPushed(RegenerateSite::class);
    }

    public function test_apagar_a_traducao_tambem_regenera(): void
    {
        $publication = Publication::create([
            'slug' => 'publicacao-sem-traducao',
            'category' => 'artigo',
            'published_at' => now(),
            'featured' => false,
            'status' => Publication::STATUS_PUBLISHED,
        ]);
        $translation = $publication->translations()->create([
            'locale' => 'en',
            'title' => 'Title',
            'summary' => 'Summary.',
            'body' => 'Text.',
        ]);

        $queue = Queue::fake();
        $translation->delete();

        Queue::assertPushed(RegenerateSite::class);
    }
}
