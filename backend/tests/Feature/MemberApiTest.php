<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Modules\Identity\Models\Member;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Tests\TestCase;

/** O CSRF de verdade: o do Laravel se desliga sozinho nos testes. */
class StrictCsrf extends ValidateCsrfToken
{
    protected function runningUnitTests(): bool
    {
        return false;
    }
}

class MemberApiTest extends TestCase
{
    use RefreshDatabase;

    private const string SITE = 'https://cosmos.rdmlabs.test';

    protected function setUp(): void
    {
        parent::setUp();
        config(['cors.allowed_origins' => [self::SITE]]);
        // Como o site pede: com Referer de um domínio stateful.
        $this->withHeader('Referer', 'http://localhost/pt/');
    }

    private function member(): Member
    {
        $member = Member::factory()->create(['name' => 'Ana', 'handle' => 'ana', 'email' => 'ana@example.com']);
        $member->identities()->create(['provider' => 'google', 'provider_user_id' => 'g-1']);

        return $member;
    }

    public function test_sem_sessao_me_devolve_204(): void
    {
        $this->getJson('/api/me')->assertNoContent();
    }

    public function test_com_sessao_me_devolve_o_perfil(): void
    {
        $this->actingAs($this->member(), 'member');

        $this->getJson('/api/me')->assertOk()->assertJson(['data' => [
            'handle' => 'ana',
            'email' => 'ana@example.com',
            'providers' => ['google'],
        ]]);
    }

    public function test_sessao_de_admin_nao_e_leitor_na_api(): void
    {
        $this->actingAs(User::factory()->create(), 'web');

        $this->getJson('/api/me')->assertNoContent();
        $this->patchJson('/api/me', ['name' => 'X'])->assertUnauthorized();
    }

    public function test_patch_atualiza_nome_handle_e_idioma(): void
    {
        $this->actingAs($member = $this->member(), 'member');

        $this->patchJson('/api/me', ['name' => 'Ana Souza', 'handle' => 'ana_s', 'locale' => 'en'])
            ->assertOk()->assertJsonPath('data.handle', 'ana_s');

        $this->assertSame(['Ana Souza', 'ana_s', 'en'], [$member->fresh()?->name, $member->fresh()?->handle, $member->fresh()?->locale]);
    }

    public function test_patch_recusa_handle_invalido_ou_de_outra_pessoa(): void
    {
        Member::factory()->create(['handle' => 'bruno']);
        $this->actingAs($this->member(), 'member');

        foreach (['bruno', 'Ana', 'ab', 'admin', 'com espaço'] as $handle) {
            $this->patchJson('/api/me', ['handle' => $handle])->assertJsonValidationErrors('handle');
        }
        $this->patchJson('/api/me', ['locale' => 'fr'])->assertJsonValidationErrors('locale');
        // O próprio handle não conta como ocupado.
        $this->patchJson('/api/me', ['handle' => 'ana'])->assertOk();
    }

    public function test_patch_exige_csrf(): void
    {
        $this->app->bind(ValidateCsrfToken::class, StrictCsrf::class);
        $this->actingAs($this->member(), 'member');

        $this->patchJson('/api/me', ['name' => 'Sem token'])->assertStatus(419);

        // O GET entrega o cookie XSRF-TOKEN; o site o devolve no cabeçalho.
        $cookie = collect($this->getJson('/api/me')->headers->getCookies())->firstWhere(fn ($cookie) => $cookie->getName() === 'XSRF-TOKEN');
        $this->assertNotNull($cookie);
        $this->patchJson('/api/me', ['name' => 'Com token'], ['X-XSRF-TOKEN' => (string) $cookie->getValue()])->assertOk();
    }

    public function test_cors_so_libera_credenciais_para_o_site(): void
    {
        $this->getJson('/api/me', ['Origin' => self::SITE])
            ->assertHeader('Access-Control-Allow-Origin', self::SITE)
            ->assertHeader('Access-Control-Allow-Credentials', 'true');

        $evil = $this->getJson('/api/me', ['Origin' => 'https://evil.example']);
        $this->assertNotSame('https://evil.example', $evil->headers->get('Access-Control-Allow-Origin'));
        $this->assertNotSame('*', $evil->headers->get('Access-Control-Allow-Origin'));

        $preflight = $this->call('OPTIONS', '/api/me', server: [
            'HTTP_ORIGIN' => 'https://evil.example',
            'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'PATCH',
        ]);
        // Com uma origem só, o pacote sempre responde a do site: o navegador
        // compara com a de quem pediu e bloqueia.
        $this->assertSame(self::SITE, $preflight->headers->get('Access-Control-Allow-Origin'));
    }

    public function test_leitura_publica_continua_aberta_sem_credencial(): void
    {
        $response = $this->getJson('/api/publications?locale=pt', ['Origin' => 'https://outro.example'])->assertOk();

        $response->assertHeader('Access-Control-Allow-Origin', '*');
        $this->assertNull($response->headers->get('Access-Control-Allow-Credentials'));
    }

    public function test_logout_encerra_a_sessao_do_leitor(): void
    {
        $this->actingAs($this->member(), 'member');

        $this->postJson('/auth/logout')->assertNoContent();

        $this->assertTrue(Auth::guard('member')->guest());
        $this->getJson('/api/me')->assertNoContent();
    }
}
