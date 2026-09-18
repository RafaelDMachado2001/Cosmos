<?php

declare(strict_types=1);

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use RuntimeException;

abstract class TestCase extends BaseTestCase
{
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
