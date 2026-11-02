<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Firebase\JWT\JWK;
use Firebase\JWT\JWT;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class VerifyGoogleOidc
{
    private const array ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

    public function handle(Request $request, Closure $next): Response
    {
        $audience = config('scheduler.oidc_audience');
        $account = config('scheduler.service_account');
        $token = $request->bearerToken();

        if (! is_string($audience) || $audience === '' || ! is_string($account) || $account === '' || $token === null) {
            abort(401);
        }

        try {
            $claims = JWT::decode($token, JWK::parseKeySet($this->keys(), 'RS256'));
        } catch (Throwable) {
            abort(401);
        }

        $valid = in_array($claims->iss ?? null, self::ISSUERS, true)
            && ($claims->aud ?? null) === $audience
            && ($claims->email ?? null) === $account
            && ($claims->email_verified ?? false) === true;

        abort_unless($valid, 401);

        return $next($request);
    }

    /**
     * @return array<string, mixed>
     */
    private function keys(): array
    {
        /** @var array<string, mixed> */
        return Cache::remember('google-oidc-jwks', 3600, static fn (): array => Http::timeout(5)
            ->get((string) config('scheduler.jwks_url'))
            ->throw()
            ->json());
    }
}
