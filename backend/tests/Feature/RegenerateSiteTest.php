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

        // Tres escritas, um job. E o mecanismo central da fase: quem esta
        // escrevendo no painel salva varias vezes seguidas, e cada salvamento
        // custaria um prerender de um minuto se ShouldBeUnique nao colapsasse
        // a rajada. Nao libere a trava aqui — liberar apaga justamente a prova.
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
        // A trava e liberada de proposito: aqui o que se mede e o observer, nao
        // a deduplicacao. O teste acima e quem cobre a deduplicacao.
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

        // Depois da criacao: interessa o dispatch do delete, nao o dela.
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

        // Um ajuste de titulo nao encosta na linha de `publications`, entao so
        // o observer de PublicationTranslation o pega. E a metade menos obvia
        // da fiacao, e a que regride em silencio.
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
