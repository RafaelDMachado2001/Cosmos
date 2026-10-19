<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Modules\Activity\Models\Activity;
use App\Modules\Identity\Models\Member;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;
use LogicException;
use Tests\TestCase;

class ActivityLogTest extends TestCase
{
    use RefreshDatabase;

    private function signIn(string $id = 'g-1'): void
    {
        config(['services.google.client_id' => 'google-id']);
        Socialite::fake('google', SocialiteUser::fake(['id' => $id, 'email' => 'ana@example.com', 'email_verified' => true]));
        $this->get('/auth/google/redirect');
        $this->get('/auth/google/callback');
    }

    public function test_o_cadastro_gera_exatamente_uma_atividade(): void
    {
        $this->signIn();
        Auth::guard('member')->logout();
        // Entrar de novo não é ação de domínio: nada novo no registro.
        $this->signIn();

        $activity = Activity::sole();
        $this->assertSame(Member::sole()->id, $activity->member_id);
        $this->assertSame('member.registered', $activity->verb);
        $this->assertSame(['member', $activity->member_id], [$activity->subject_type, $activity->subject_id]);
        $this->assertSame(['provider' => 'google'], $activity->payload);
    }

    public function test_update_direto_no_banco_falha(): void
    {
        $activity = Activity::record(Member::factory()->create()->id, 'member.registered');

        $this->expectException(QueryException::class);
        $this->expectExceptionMessage('append-only');

        // Só o payload, que a anonimização poderia reescrever: sem o
        // cosmos.anonymizing ligado, nem isso.
        DB::table('activities')->where('id', $activity->id)->update(['payload' => '{}']);
    }

    public function test_delete_direto_no_banco_falha(): void
    {
        $activity = Activity::record(Member::factory()->create()->id, 'member.registered');

        $this->expectException(QueryException::class);

        DB::table('activities')->where('id', $activity->id)->delete();
    }

    public function test_o_modelo_nao_edita_nem_apaga(): void
    {
        $activity = Activity::record(Member::factory()->create()->id, 'member.registered');

        try {
            $activity->update(['verb' => 'x']);
            $this->fail('update passou');
        } catch (LogicException) {
        }

        $this->expectException(LogicException::class);
        $activity->delete();
    }

    public function test_a_anonimizacao_so_reescreve_o_payload(): void
    {
        $activity = Activity::record(Member::factory()->create()->id, 'member.registered', payload: ['provider' => 'google']);

        DB::transaction(function () use ($activity): void {
            DB::statement("SET LOCAL cosmos.anonymizing = 'on'");
            DB::table('activities')->where('id', $activity->id)->update(['payload' => '{}']);
        });
        $this->assertSame([], Activity::findOrFail($activity->id)->payload);

        $this->expectException(QueryException::class);
        DB::transaction(function () use ($activity): void {
            DB::statement("SET LOCAL cosmos.anonymizing = 'on'");
            DB::table('activities')->where('id', $activity->id)->update(['verb' => 'outra.coisa']);
        });
    }
}
