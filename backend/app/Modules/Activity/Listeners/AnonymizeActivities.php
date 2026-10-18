<?php

declare(strict_types=1);

namespace App\Modules\Activity\Listeners;

use App\Modules\Identity\Events\MemberDeleted;
use Illuminate\Support\Facades\DB;

/**
 * Limpa o payload das atividades de quem apagou a conta. Verbo, alvo e data
 * ficam: não identificam ninguém, e é deles que saem os números agregados.
 *
 * Roda dentro da transação do DeleteMember; o SET LOCAL vale só para ela.
 */
final class AnonymizeActivities
{
    public function handle(MemberDeleted $event): void
    {
        DB::statement("SET LOCAL cosmos.anonymizing = 'on'");
        DB::table('activities')->where('member_id', $event->memberId)->update(['payload' => '{}']);
    }
}
