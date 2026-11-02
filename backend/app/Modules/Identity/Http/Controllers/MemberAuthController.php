<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Identity\Actions\SignInWithProvider;
use App\Modules\Identity\Auth\ProviderProfile;
use App\Modules\Identity\Support\ReturnUrl;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Laravel\Socialite\Contracts\Provider;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\AbstractProvider;
use Symfony\Component\HttpFoundation\RedirectResponse as SymfonyRedirectResponse;
use Throwable;

class MemberAuthController extends Controller
{
    private const RETURN_KEY = 'member_auth.return';

    public function redirect(Request $request, string $provider): SymfonyRedirectResponse
    {
        $request->session()->put(self::RETURN_KEY, ReturnUrl::path($request->query('return')));

        return $this->driver($provider)->redirect();
    }

    public function callback(Request $request, string $provider, SignInWithProvider $signIn): RedirectResponse
    {
        $return = ReturnUrl::path($request->session()->pull(self::RETURN_KEY));

        try {
            $profile = ProviderProfile::from($provider, $this->driver($provider)->user());
        } catch (Throwable $exception) {
            Log::warning('login de leitor falhou no provedor', ['provider' => $provider, 'erro' => $exception->getMessage()]);

            return redirect()->away(ReturnUrl::absolute($return, 'failed'));
        }

        if (! $profile->emailVerified || $profile->email === null) {
            return redirect()->away(ReturnUrl::absolute($return, 'unverified'));
        }

        $member = $signIn->handle($profile, ReturnUrl::locale($return));

        Auth::guard('member')->login($member);

        return redirect()->away(ReturnUrl::absolute($return));
    }

    private function driver(string $provider): Provider
    {
        abort_unless(in_array($provider, ProviderProfile::PROVIDERS, true), 404);
        abort_if((string) config("services.{$provider}.client_id") === '', 404);

        /** @var AbstractProvider $driver */
        $driver = Socialite::driver($provider);
        $driver->redirectUrl(route('member.auth.callback', ['provider' => $provider]));

        return $driver;
    }
}
