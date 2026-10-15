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
        /** @var SocialiteUser $googleUser */
        $googleUser = Socialite::driver('google')->user();

        if (! $this->allowed($googleUser)) {
            // Alcançar aqui com uma conta Google de verdade, só fora do
            // allowlist, é o caso que mais importa registrar: é tentativa de
            // acesso, não erro de configuração.
            Log::warning('login Google recusado: e-mail fora do allowlist', [
                'email' => $googleUser->getEmail(),
            ]);

            abort(403);
        }

        $user = User::firstOrCreate(
            ['email' => $googleUser->getEmail()],
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
