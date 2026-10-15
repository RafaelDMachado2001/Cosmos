<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;
use Tests\TestCase;

class GoogleLoginTest extends TestCase
{
    use RefreshDatabase;

    private function fakeGoogleUser(string $email, bool $verified = true): SocialiteUser
    {
        return SocialiteUser::fake([
            'email' => $email,
            'email_verified' => $verified,
        ]);
    }

    public function test_a_tela_de_login_mostra_o_botao_do_google(): void
    {
        $this->get('/admin/login')
            ->assertOk()
            ->assertSee('Entrar com Google')
            ->assertSee(route('auth.google.redirect'), false);
    }

    public function test_callback_aceita_o_email_do_allowlist_e_autentica(): void
    {
        Socialite::fake('google', $this->fakeGoogleUser((string) config('admin.email')));

        $this->get(route('auth.google.callback'))->assertRedirect();

        $this->assertTrue(Auth::check());
        $this->assertSame(config('admin.email'), Auth::user()?->email);
    }

    public function test_callback_recusa_email_fora_do_allowlist(): void
    {
        Socialite::fake('google', $this->fakeGoogleUser('alguem.mais@gmail.com'));

        $this->get(route('auth.google.callback'))->assertForbidden();

        $this->assertTrue(Auth::guest());
    }

    public function test_callback_recusa_email_nao_verificado_mesmo_no_allowlist(): void
    {
        // Um e-mail não verificado no provedor não prova que a pessoa é dona
        // dele — aceitar aqui seria confiar numa declaração, não numa conta.
        Socialite::fake('google', $this->fakeGoogleUser((string) config('admin.email'), verified: false));

        $this->get(route('auth.google.callback'))->assertForbidden();

        $this->assertTrue(Auth::guest());
    }

    public function test_callback_reusa_o_administrador_ja_existente_em_vez_de_duplicar(): void
    {
        $existing = User::factory()->create(['email' => config('admin.email')]);
        Socialite::fake('google', $this->fakeGoogleUser((string) config('admin.email')));

        $this->get(route('auth.google.callback'));

        $this->assertSame(1, User::count());
        $this->assertTrue(Auth::user()?->is($existing));
    }

    public function test_a_11a_tentativa_de_login_no_mesmo_minuto_recebe_429(): void
    {
        for ($i = 0; $i < 10; $i++) {
            $this->get('/admin/login/google')->assertStatus(302);
        }

        $this->get('/admin/login/google')->assertStatus(429);
    }
}
