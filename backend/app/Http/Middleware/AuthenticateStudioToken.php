<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Models\StudioToken;
use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateStudioToken
{
    public function handle(Request $request, Closure $next): Response
    {
        $plain = $request->bearerToken();
        $token = $plain === null ? null : StudioToken::findValid($plain);

        if ($token === null || ! $token->user->isAdmin()) {
            return response()
                ->json(['message' => 'Token do Studio ausente, inválido ou expirado.'], 401)
                ->header('WWW-Authenticate', 'Bearer realm="rdm-studio"');
        }

        $now = CarbonImmutable::now();
        if ($token->last_used_at === null || $token->last_used_at->lt($now->subMinute())) {
            $token->forceFill(['last_used_at' => $now])->saveQuietly();
        }

        Auth::shouldUse('web');
        Auth::guard('web')->setUser($token->user);
        $request->attributes->set('studio_token', $token);

        return $next($request);
    }
}
