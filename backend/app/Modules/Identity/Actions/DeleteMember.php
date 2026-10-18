<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Events\MemberDeleted;
use App\Modules\Identity\Models\Member;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Apaga a conta a pedido do dono (LGPD), sem apagar a linha.
 *
 * As identidades somem, e com elas o caminho de volta pelo login. O membro
 * fica anonimizado — nome genérico, handle aleatório, sem e-mail nem avatar —
 * para as atividades continuarem apontando para alguém e os números
 * agregados não mudarem. Quem guarda outro dado pessoal escuta MemberDeleted.
 */
final class DeleteMember
{
    public function handle(Member $member): void
    {
        DB::transaction(function () use ($member): void {
            $member->identities()->delete();

            $member->forceFill([
                'name' => 'Conta removida',
                'handle' => 'removida_'.Str::lower(Str::random(16)),
                'avatar_url' => null,
                'email' => null,
                'email_verified_at' => null,
            ])->save();
            $member->delete();

            MemberDeleted::dispatch($member->id);
        });
    }
}
