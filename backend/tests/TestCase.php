<?php

declare(strict_types=1);

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Queue;
use RuntimeException;

abstract class TestCase extends BaseTestCase
{
    /**
     * Fila falsa por padrão em toda a suíte.
     *
     * `PublicationObserver` dispara `RegenerateSite::dispatch()` em qualquer
     * `saved`/`deleted` de `Publication` ou `PublicationTranslation` — e isso
     * inclui os `Publication::create()` de testes que nada têm a ver com o
     * job. Com `QUEUE_CONNECTION=sync` no phpunit.xml, sem esta fila falsa
     * cada um desses testes executaria o prerender de verdade, contra um
     * `/srv/site` que sequer existe no container `app`. Testes que querem
     * observar o dispatch chamam `Queue::fake()` de novo — é idempotente.
     * Um teste que precise mesmo do driver `sync` real tem que desfazer isto
     * explicitamente: `Queue::clearResolvedInstance('queue'); $this->app
     * ->forgetInstance('queue');` antes do trecho que depende da fila de
     * verdade.
     */
    protected function setUp(): void
    {
        parent::setUp();

        Queue::fake();
    }

    /**
     * A trava que impede a suíte de apagar o banco de desenvolvimento.
     *
     * `RefreshDatabase` migra do zero, e uma configuração de ambiente errada é
     * suficiente para ele fazer isso no banco errado — sem erro nenhum, com a
     * suíte passando. Já aconteceu aqui: o `force` do phpunit.xml escreve em
     * `$_ENV`, mas o Laravel consulta `$_SERVER` antes, e era o docker-compose
     * que mandava ali.
     *
     * Roda logo depois de a aplicação subir — onde a configuração já existe — e
     * antes de `setUpTraits()`, que é quem dispara a migração.
     */
    protected function refreshApplication(): void
    {
        parent::refreshApplication();

        $database = (string) config('database.connections.'.config('database.default').'.database');

        if (! str_ends_with($database, '_test')) {
            throw new RuntimeException(
                "A suíte ia rodar contra «{$database}», que não é um banco de teste. ".
                'Conferir DB_DATABASE no phpunit.xml, no backend/.env e no docker-compose.yml.'
            );
        }
    }
}
