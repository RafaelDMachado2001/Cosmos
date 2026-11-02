<?php

declare(strict_types=1);

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Queue;
use RuntimeException;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Queue::fake();
    }

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
