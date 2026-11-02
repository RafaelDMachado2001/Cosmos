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
            Log::warning('login Google falhou ao buscar o usuario', [
                'erro' => $exception->getMessage(),
            ]);

            return redirect('/admin/login');
        }

        if (! $this->allowed($googleUser)) {
            Log::warning('login Google recusado: e-mail fora do allowlist', [
                'email' => $googleUser->getEmail(),
            ]);

            abort(403);
        }

        $user = User::firstOrCreate(
            ['email' => (string) config('admin.email')],
            [
                'name' => $googleUser->getName() ?? (string) config('admin.name'),
                'password' => Hash::make(Str::random(40)),
                'email_verified_at' => now(),
            ],
        );

        Auth::guard('web')->login($user, remember: true);

        return redirect()->intended(Filament::getUrl());
    }

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
