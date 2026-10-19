<?php

declare(strict_types=1);

namespace App\Modules\Identity\Events;

use Illuminate\Foundation\Events\Dispatchable;

/**
 * Uma conta apagada a pedido do dono. Disparado dentro da transação que a
 * anonimiza: quem escuta limpa o próprio dado pessoal no mesmo commit, e se
 * falhar, a conta não some pela metade.
 */
final class MemberDeleted
{
    use Dispatchable;

    public function __construct(
        public readonly int $memberId,
    ) {}
}
