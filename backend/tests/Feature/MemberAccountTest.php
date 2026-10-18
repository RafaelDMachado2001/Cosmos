<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Modules\Identity\Models\Member;
use App\Modules\Identity\Support\Handle;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class MemberAccountTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Entrar por um guard numa requisição e bater no outro na seguinte,
        // com a mesma sessão: é o caminho real, não o actingAs em memória.
        Route::middleware('web')->group(function (): void {
            Route::post('/_t/login/{guard}/{id}', function (string $guard, int $id) {
                Auth::guard($guard)->loginUsingId($id);

                return 'ok';
            });
            Route::get('/_t/member', fn () => 'member')->middleware('auth:member');
            Route::get('/_t/admin', fn () => 'admin')->middleware('auth:web');
        });
    }

    public function test_sessao_de_admin_nao_autentica_como_membro(): void
    {
        // Mesmo id nas duas tabelas: só a chave da sessão separa os dois.
        $admin = User::factory()->create();
        Member::factory()->create(['id' => $admin->id]);

        $this->post("/_t/login/web/{$admin->id}")->assertOk();

        $this->get('/_t/admin')->assertOk();
        $this->getJson('/_t/member')->assertUnauthorized();
    }

    public function test_sessao_de_membro_nao_autentica_como_admin(): void
    {
        $member = Member::factory()->create();
        User::factory()->create(['id' => $member->id]);

        $this->post("/_t/login/member/{$member->id}")->assertOk();

        $this->get('/_t/member')->assertOk();
        $this->getJson('/_t/admin')->assertUnauthorized();
    }

    public function test_handle_repetido_ganha_sufixo_numerico(): void
    {
        $this->assertSame('ana_souza', Handle::unique('Ana Souza'));
        Member::factory()->create(['handle' => 'ana_souza']);
        $this->assertSame('ana_souza2', Handle::unique('Ana Souza'));
        Member::factory()->create(['handle' => 'ana_souza2']);
        $this->assertSame('ana_souza3', Handle::unique('Ana Souza'));
    }

    public function test_handle_de_conta_apagada_continua_ocupado(): void
    {
        Member::factory()->create(['handle' => 'bruno'])->delete();

        $this->assertSame('bruno2', Handle::unique('Bruno'));
    }

    public function test_handle_normaliza_acento_e_cai_para_o_email(): void
    {
        $this->assertSame('joao_conceicao', Handle::base('João  Conceição!'));
        $this->assertSame('dev_42', Handle::base('李', 'dev.42@example.com'));
        $this->assertSame('leitor', Handle::base('李', 'x@example.com'));
    }

    public function test_handle_reservado_nunca_e_atribuido(): void
    {
        $this->assertSame('admin2', Handle::unique('Admin'));
    }

    public function test_o_banco_recusa_handle_fora_do_formato(): void
    {
        $this->expectException(QueryException::class);

        Member::factory()->create(['handle' => 'Ana']);
    }
}
