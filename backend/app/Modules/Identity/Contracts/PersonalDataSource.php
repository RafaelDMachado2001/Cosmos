<?php

declare(strict_types=1);

namespace App\Modules\Identity\Contracts;

/**
 * Um módulo que guarda dado de um membro e o entrega no export
 * (GET /api/me/export). O Identity não conhece quem implementa: cada módulo
 * se registra com a tag PersonalDataSource::TAG no próprio provider.
 */
interface PersonalDataSource
{
    public const TAG = 'identity.personal-data';

    /** A chave do bloco no JSON do export. */
    public function key(): string;

    /** @return array<int|string, mixed> */
    public function export(int $memberId): array;
}
