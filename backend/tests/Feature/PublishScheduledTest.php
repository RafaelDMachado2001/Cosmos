<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Jobs\RegenerateSite;
use App\Models\Publication;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class PublishScheduledTest extends TestCase
{
    use RefreshDatabase;

    private function create(string $slug, string $publishedAt): Publication
    {
        return Publication::create([
            'slug' => $slug,
            'category' => 'artigo',
            'published_at' => $publishedAt,
            'featured' => false,
            'status' => Publication::STATUS_PUBLISHED,
        ]);
    }

    public function test_nao_dispara_nada_na_primeira_execucao(): void
    {
        // A criação já disparou uma regeração de verdade pelo observer; o
        // que importa aqui é só o comando, por isso a trava de unicidade é
        // liberada antes de fakear a fila — senão o dispatch do observer
        // esconderia o que o comando teria feito.
        $this->create('ja-elegivel-desde-sempre', now()->subDay()->toIso8601String());
        $queue = Queue::fake();
        $queue->releaseUniqueJobLocks();

        $this->artisan('publications:publish-scheduled')->assertSuccessful();

        // Primeira execução: a contagem atual vira a própria linha de base.
        // Disparar aqui regeneraria o site a cada deploy sem nenhuma
        // publicação ter de fato cruzado published_at.
        Queue::assertNotPushed(RegenerateSite::class);
    }

    public function test_dispara_quando_uma_publicacao_cruza_published_at(): void
    {
        $this->create('ja-elegivel', now()->subDay()->toIso8601String());
        $this->artisan('publications:publish-scheduled'); // estabelece a linha de base

        $this->create('acabou-de-cruzar', now()->subMinute()->toIso8601String());
        $queue = Queue::fake();
        $queue->releaseUniqueJobLocks();

        $this->artisan('publications:publish-scheduled')->assertSuccessful();

        Queue::assertPushed(RegenerateSite::class);
    }

    public function test_nao_dispara_quando_nada_cruzou(): void
    {
        $this->create('ja-elegivel-2', now()->subDay()->toIso8601String());
        $this->create('agendada-para-o-futuro', now()->addDay()->toIso8601String());
        $this->artisan('publications:publish-scheduled'); // estabelece a linha de base

        $queue = Queue::fake();
        $queue->releaseUniqueJobLocks();
        $this->artisan('publications:publish-scheduled')->assertSuccessful();

        Queue::assertNotPushed(RegenerateSite::class);
    }

    public function test_transiciona_agendada_para_publicada_quando_a_data_chega(): void
    {
        $publication = Publication::create([
            'slug' => 'agendada-que-chegou',
            'category' => 'artigo',
            'published_at' => now()->subMinute(),
            'featured' => false,
            'status' => Publication::STATUS_SCHEDULED,
        ]);

        $queue = Queue::fake();
        $queue->releaseUniqueJobLocks();

        $this->artisan('publications:publish-scheduled')->assertSuccessful();

        $this->assertSame(Publication::STATUS_PUBLISHED, $publication->refresh()->status);
        Queue::assertPushed(RegenerateSite::class);
    }

    public function test_nao_transiciona_agendada_cuja_data_ainda_nao_chegou(): void
    {
        $publication = Publication::create([
            'slug' => 'agendada-para-depois',
            'category' => 'artigo',
            'published_at' => now()->addDay(),
            'featured' => false,
            'status' => Publication::STATUS_SCHEDULED,
        ]);

        $this->artisan('publications:publish-scheduled')->assertSuccessful();

        $this->assertSame(Publication::STATUS_SCHEDULED, $publication->refresh()->status);
    }

    public function test_sobrevive_a_uma_pausa_contando_pelo_total_nao_pela_janela(): void
    {
        // Duas publicações cruzam enquanto o scheduler, por hipótese, não
        // rodou — a comparação é contra o total em cache, nunca contra uma
        // janela de tempo, então nenhuma delas se perde.
        $this->create('cruzou-1', now()->subDay()->toIso8601String());
        $this->artisan('publications:publish-scheduled'); // estabelece a linha de base

        Cache::forget('publications:eligible-count');
        $this->create('cruzou-2', now()->subMinute()->toIso8601String());
        $this->create('cruzou-3', now()->subSeconds(30)->toIso8601String());

        // A "pausa" não zera a contagem anterior: simula reatribuindo o valor
        // que o tick anterior já tinha gravado.
        Cache::forever('publications:eligible-count', 1);

        $queue = Queue::fake();
        $queue->releaseUniqueJobLocks();
        $this->artisan('publications:publish-scheduled')->assertSuccessful();

        Queue::assertPushed(RegenerateSite::class, 1);
    }
}
