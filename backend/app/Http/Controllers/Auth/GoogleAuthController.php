<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Filament\Facades\Filament;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;
use Symfony\Component\HttpFoundation\RedirectResponse as SymfonyRedirectResponse;

/**
 * Login do painel por Google, sem senha.
 *
 * `config('admin.email')` é o allowlist — o mesmo endereço que o
 * `DatabaseSeeder` já usa para criar o único administrador. Qualquer outro
 * e-mail, mesmo autenticado de verdade no Google, é recusado: um painel de
 * um autor só não ganha uma segunda conta só porque alguém mais tem Google.
 */
class GoogleAuthController extends Controller
{
    public function redirect(): SymfonyRedirectResponse
    {
        return Socialite::driver('google')->redirect();
    }

    public function callback(): RedirectResponse
    {
        try {
            /** @var SocialiteUser $googleUser */
            $googleUser = Socialite::driver('google')->user();
        } catch (\Throwable $exception) {
            // Timeout, token revogado, ou qualquer outra falha do lado do
            // Google: sem isto, a exceção subia crua até a página de erro
            // genérica do Laravel em vez de devolver quem tentou entrar ao
            // botão, que é tudo que faz sentido oferecer aqui.
            Log::warning('login Google falhou ao buscar o usuario', [
                'erro' => $exception->getMessage(),
            ]);

            return redirect('/admin/login');
        }

        if (! $this->allowed($googleUser)) {
            // Alcançar aqui com uma conta Google de verdade, só fora do
            // allowlist, é o caso que mais importa registrar: é tentativa de
            // acesso, não erro de configuração.
            Log::warning('login Google recusado: e-mail fora do allowlist', [
                'email' => $googleUser->getEmail(),
            ]);

            abort(403);
        }

        // A chave é o allowlist, não o e-mail como o Google devolveu: a
        // comparação em allowed() já é case-insensitive, mas a busca no
        // banco não é — se o Google um dia devolver outra capitalização do
        // mesmo endereço, buscar por `$googleUser->getEmail()` criaria um
        // segundo administrador em vez de reusar o existente.
        $user = User::firstOrCreate(
            ['email' => (string) config('admin.email')],
            [
                'name' => $googleUser->getName() ?? (string) config('admin.name'),
                // Nunca usada para autenticar — não há mais formulário de
                // senha no painel — mas a coluna é obrigatória no schema.
                'password' => Hash::make(Str::random(40)),
                'email_verified_at' => now(),
            ],
        );

        Auth::guard('web')->login($user, remember: true);

        return redirect()->intended(Filament::getUrl());
    }

    /**
     * O e-mail precisa bater com o allowlist E vir verificado pelo Google —
     * sem a segunda condição, qualquer pessoa com uma conta Google qualquer
     * poderia declarar o e-mail de outra pessoa no provedor errado.
     */
    private function allowed(SocialiteUser $googleUser): bool
    {
        $email = $googleUser->getEmail();
        if ($email === null) {
            return false;
        }

        $raw = $googleUser->getRaw();
        $verified = $raw['email_verified'] ?? $raw['verified_email'] ?? false;
        if (! $verified) {
            return false;
        }

        return strcasecmp($email, (string) config('admin.email')) === 0;
    }
}
