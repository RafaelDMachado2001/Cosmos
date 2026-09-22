<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Jobs\RegenerateSite;
use App\Models\Publication;
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
        $queue = Queue::fake();

        $publication = Publication::create([
            'slug' => 'publicacao-editada',
            'category' => 'artigo',
            'published_at' => now(),
            'featured' => false,
            'status' => Publication::STATUS_DRAFT,
        ]);
        // A trava de ShouldBeUnique e real e sincrona: ela e adquirida dentro
        // do proprio dispatch(), nao so quando o worker de fato roda o job.
        // Sem soltar aqui, as duas escritas seguintes seriam silenciosamente
        // descartadas pela trava — que e a deduplicacao de verdade, e o que
        // este teste quer isolar e o observer, nao ela. Por isso soltar entre
        // uma escrita e outra: cada dispatch() deve tentar de novo.
        $queue->releaseUniqueJobLocks();
        $publication->update(['status' => Publication::STATUS_PUBLISHED]);
        $queue->releaseUniqueJobLocks();
        $publication->update(['featured' => true]);

        // ShouldBeUnique responde pela deduplicacao real na fila; aqui o que se
        // garante e que o observer dispara em toda escrita, e nao so na criacao.
        Queue::assertPushed(RegenerateSite::class, 3);
    }
}
