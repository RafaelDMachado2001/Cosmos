<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\StudioToken;
use App\Models\User;
use Illuminate\Contracts\View\View;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class StudioTokenController extends Controller
{
    public function index(Request $request): View
    {
        return view('admin.studio-tokens', [
            'tokens' => $this->admin($request)->studioTokens()->latest()->get(),
            'issued' => $request->session()->pull('studio_token_plain'),
            'maxDays' => StudioToken::MAX_DAYS,
            'apiBase' => $this->apiBase(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'days' => ['required', 'integer', 'between:1,'.StudioToken::MAX_DAYS],
        ]);

        [, $plain] = StudioToken::issue($this->admin($request), $data['name'], (int) $data['days']);
        $request->session()->put('studio_token_plain', $plain);

        return redirect()->route('studio-tokens.index');
    }

    public function destroy(Request $request, int $token): RedirectResponse
    {
        $this->admin($request)->studioTokens()->whereKey($token)->delete();

        return redirect()->route('studio-tokens.index');
    }

    public function current(Request $request): JsonResponse
    {
        $token = $request->attributes->get('studio_token');
        abort_unless($token instanceof StudioToken, 401);

        return response()->json(['data' => [
            'user' => $token->user->email,
            'token' => [
                'id' => $token->id,
                'name' => $token->name,
                'expiresAt' => $token->expires_at->toIso8601String(),
            ],
        ]]);
    }

    private function apiBase(): string
    {
        $host = config('hosts.api');

        return is_string($host) && $host !== '' ? "https://{$host}/api/studio" : url('/api/studio');
    }

    private function admin(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User && $user->isAdmin(), 403);

        return $user;
    }
}
