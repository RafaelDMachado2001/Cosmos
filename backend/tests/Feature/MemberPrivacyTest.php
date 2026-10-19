<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Modules\Activity\Models\Activity;
use App\Modules\Identity\Models\Member;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;
use Tests\TestCase;

class MemberPrivacyTest extends TestCase
{
    use RefreshDatabase;

    private const string EMAIL = 'ana.souza@example.com';

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.google.client_id' => 'google-id']);
        $this->withHeader('Referer', 'http://localhost/pt/');
    }

    /** Pelo caminho de verdade: o login cria conta, identidade e atividade. */
    private function signIn(): Member
    {
        Socialite::fake('google', SocialiteUser::fake([
            'id' => 'g-1', 'name' => 'Ana Souza', 'email' => self::EMAIL, 'email_verified' => true,
            'avatar' => 'https://lh3.example/ana.jpg',
        ]));
        $this->get('/auth/google/redirect');
        $this->get('/auth/google/callback');

        return Member::sole();
    }

    public function test_depois_do_delete_nenhuma_coluna_guarda_o_email(): void
    {
        $member = $this->signIn();

        $this->deleteJson('/api/me')->assertNoContent();

        $row = (array) DB::table('members')->where('id', $member->id)->first();
        // Os valores exatos, não "ana": o handle aleatório pode conter a sílaba.
        foreach ($row as $column => $value) {
            foreach ([self::EMAIL, 'Ana Souza', 'ana_souza', 'lh3.example'] as $personal) {
                $this->assertStringNotContainsStringIgnoringCase($personal, (string) $value, "members.$column ainda identifica");
            }
        }
        $this->assertSame('Conta removida', $row['name']);
        $this->assertNotNull($row['deleted_at']);
        $this->assertSame(0, DB::table('member_identities')->count());
        $this->assertStringNotContainsString('google', json_encode(DB::table('activities')->pluck('payload')) ?: '');
    }

    public function test_as_atividades_ficam_para_os_numeros_agregados(): void
    {
        $member = $this->signIn();

        $this->deleteJson('/api/me')->assertNoContent();

        $activity = Activity::sole();
        $this->assertSame([$member->id, 'member.registered', []], [$activity->member_id, $activity->verb, $activity->payload]);
    }

    public function test_o_delete_encerra_a_sessao_e_o_login_seguinte_e_conta_nova(): void
    {
        $old = $this->signIn();
        $this->deleteJson('/api/me')->assertNoContent();
        // Cada requisição real nasce com os guards vazios; aqui o app é um só,
        // e o guard do Sanctum guardaria o membro da requisição anterior.
        Auth::forgetGuards();

        $this->assertTrue(Auth::guard('member')->guest());
        $this->getJson('/api/me')->assertNoContent();

        $this->get('/auth/google/redirect');
        $this->get('/auth/google/callback');

        $new = Member::sole();
        $this->assertNotSame($old->id, $new->id);
        // A conta anonimizada ganhou um handle aleatório: o antigo volta a
        // ficar livre para a dona.
        $this->assertSame('ana_souza', $new->handle);
    }

    public function test_o_export_tem_o_perfil_e_as_atividades(): void
    {
        $this->signIn();

        $this->getJson('/api/me/export')
            ->assertOk()
            ->assertHeader('Content-Disposition', 'attachment; filename="cosmos-meus-dados.json"')
            ->assertJsonPath('profile.email', self::EMAIL)
            ->assertJsonPath('identities.0.provider', 'google')
            ->assertJsonPath('activities.0.verb', 'member.registered')
            ->assertJsonPath('activities.0.payload.provider', 'google');
    }

    public function test_sem_sessao_nem_apaga_nem_exporta(): void
    {
        $this->deleteJson('/api/me')->assertUnauthorized();
        $this->getJson('/api/me/export')->assertUnauthorized();
    }
}
