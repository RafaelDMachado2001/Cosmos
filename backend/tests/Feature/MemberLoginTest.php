<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Modules\Identity\Events\MemberRegistered;
use App\Modules\Identity\Models\Member;
use App\Modules\Identity\Models\MemberIdentity;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Event;
use Illuminate\Testing\TestResponse;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\InvalidStateException;
use Laravel\Socialite\Two\User as SocialiteUser;
use Tests\TestCase;

class MemberLoginTest extends TestCase
{
    use RefreshDatabase;

    private const string SITE = 'https://cosmos.rdmlabs.test';

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'hosts.site' => self::SITE,
            'services.google.client_id' => 'google-id',
            'services.github.client_id' => 'github-id',
        ]);
    }

    /** @param array<string, mixed> $attributes */
    private function google(array $attributes = []): SocialiteUser
    {
        return SocialiteUser::fake(['id' => 'g-1', 'name' => 'Ana Souza', 'email' => 'Ana@Example.com', 'email_verified' => true, ...$attributes]);
    }

    private function login(string $provider, SocialiteUser $user, string $return = '/pt/publicacoes/primeira'): TestResponse
    {
        Socialite::fake($provider, $user);
        $this->get("/auth/{$provider}/redirect?return=".urlencode($return))->assertRedirect();

        return $this->get("/auth/{$provider}/callback");
    }

    public function test_primeiro_login_cria_conta_e_identidade(): void
    {
        Event::fake([MemberRegistered::class]);

        $this->login('google', $this->google())->assertRedirect(self::SITE.'/pt/publicacoes/primeira');

        $member = Member::sole();
        $this->assertSame('ana_souza', $member->handle);
        $this->assertSame('ana@example.com', $member->email);
        $this->assertSame('pt', $member->locale);
        $this->assertSame(['google', 'g-1'], [$member->identities()->sole()->provider, $member->identities()->sole()->provider_user_id]);
        $this->assertTrue(Auth::guard('member')->user()?->is($member));
        $this->assertTrue(Auth::guard('web')->guest());
        Event::assertDispatchedTimes(MemberRegistered::class, 1);
    }

    public function test_segundo_login_reaproveita_a_conta(): void
    {
        Event::fake([MemberRegistered::class]);

        $this->login('google', $this->google());
        Auth::guard('member')->logout();
        // O nome mudou no Google e o e-mail também: a ligação é pelo id.
        $this->login('google', $this->google(['name' => 'Ana S.', 'email' => 'nova@example.com']));

        $this->assertSame(1, Member::count());
        $this->assertSame(1, MemberIdentity::count());
        Event::assertDispatchedTimes(MemberRegistered::class, 1);
    }

    public function test_email_nao_verificado_e_recusado(): void
    {
        $this->login('google', $this->google(['email_verified' => false]))
            ->assertRedirect(self::SITE.'/pt/publicacoes/primeira?login=unverified');

        $this->assertSame(0, Member::count());
        $this->assertTrue(Auth::guard('member')->guest());
    }

    public function test_github_sem_email_primario_verificado_e_recusado(): void
    {
        // O Socialite devolve nulo quando /user/emails não tem primário verificado.
        $this->login('github', SocialiteUser::fake(['id' => 77, 'email' => null]))
            ->assertRedirect(self::SITE.'/pt/publicacoes/primeira?login=unverified');

        $this->assertSame(0, Member::count());
    }

    public function test_o_mesmo_email_verificado_liga_os_dois_provedores(): void
    {
        $this->login('google', $this->google());
        Auth::guard('member')->logout();
        $this->login('github', SocialiteUser::fake(['id' => 77, 'name' => null, 'nickname' => 'ana-gh', 'email' => 'ana@example.com']));

        $member = Member::sole();
        $this->assertEqualsCanonicalizing(['google', 'github'], $member->identities()->pluck('provider')->all());
        $this->assertTrue(Auth::guard('member')->user()?->is($member));
    }

    public function test_retorno_para_outro_host_volta_para_a_home(): void
    {
        foreach (['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', 'pt/sem-barra'] as $return) {
            $this->login('google', $this->google(), $return)->assertRedirect(self::SITE.'/');
            Auth::guard('member')->logout();
        }
    }

    public function test_conta_nova_herda_o_idioma_de_onde_a_pessoa_veio(): void
    {
        $this->login('google', $this->google(), '/en/publications/first')
            ->assertRedirect(self::SITE.'/en/publications/first');

        $this->assertSame('en', Member::sole()->locale);
    }

    public function test_o_login_troca_o_id_da_sessao(): void
    {
        Socialite::fake('google', $this->google());
        $this->get('/auth/google/redirect');
        $before = session()->getId();

        $this->get('/auth/google/callback');

        $this->assertNotSame($before, session()->getId());
    }

    public function test_falha_no_provedor_devolve_com_aviso(): void
    {
        Socialite::fake('google', fn () => throw new InvalidStateException);
        $this->get('/auth/google/redirect?return=/en');

        $this->get('/auth/google/callback')->assertRedirect(self::SITE.'/en?login=failed');
    }

    public function test_provedor_desconhecido_ou_sem_credencial_nao_existe(): void
    {
        $this->get('/auth/facebook/redirect')->assertNotFound();

        config(['services.github.client_id' => '']);
        $this->get('/auth/github/redirect')->assertNotFound();
    }

    public function test_o_login_do_leitor_so_responde_no_host_da_api(): void
    {
        config(['hosts.admin' => 'admin.rdmlabs.test', 'hosts.api' => 'api.rdmlabs.test']);
        Socialite::fake('google', $this->google());

        $this->get('http://admin.rdmlabs.test/auth/google/redirect')->assertNotFound();
        $response = $this->get('http://api.rdmlabs.test/auth/google/redirect')->assertRedirect();

        $this->assertNotNull(collect($response->headers->getCookies())->firstWhere(fn ($cookie) => $cookie->getName() === 'rdm_session'));
    }
}
