<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Identity\Actions\DeleteMember;
use App\Modules\Identity\Contracts\PersonalDataSource;
use App\Modules\Identity\Http\Resources\MemberResource;
use App\Modules\Identity\Models\Member;
use App\Modules\Identity\Support\Handle;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class MeController extends Controller
{
    public function show(Request $request): JsonResponse|Response
    {
        $member = $request->user('sanctum');

        return $member instanceof Member ? $this->profile($member) : response()->noContent();
    }

    public function update(Request $request): JsonResponse
    {
        /** @var Member $member */
        $member = $request->user('sanctum');

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'min:1', 'max:80'],
            'handle' => [
                'sometimes', 'string',
                static fn (string $attribute, mixed $value, \Closure $fail) => is_string($value) && Handle::isValid($value) ? null : $fail('handle inválido'),
                Rule::unique('members', 'handle')->ignore($member->id),
            ],
            'locale' => ['sometimes', Rule::in((array) config('publications.locales'))],
        ]);

        $member->update($data);

        return $this->profile($member);
    }

    public function export(Request $request): JsonResponse
    {
        /** @var Member $member */
        $member = $request->user('sanctum');

        $data = [
            'profile' => [
                'name' => $member->name,
                'handle' => $member->handle,
                'email' => $member->email,
                'avatarUrl' => $member->avatar_url,
                'locale' => $member->locale,
                'createdAt' => $member->created_at->toIso8601String(),
            ],
            'identities' => $member->identities()->get(['provider', 'provider_user_id', 'created_at'])
                ->map(static fn ($identity): array => ['provider' => $identity->provider, 'providerUserId' => $identity->provider_user_id])
                ->all(),
        ];

        /** @var PersonalDataSource $source */
        foreach (app()->tagged(PersonalDataSource::TAG) as $source) {
            $data[$source->key()] = $source->export($member->id);
        }

        return response()->json($data, 200, [
            'Content-Disposition' => 'attachment; filename="cosmos-meus-dados.json"',
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    public function destroy(Request $request, DeleteMember $delete): Response
    {
        /** @var Member $member */
        $member = $request->user('sanctum');

        $delete->handle($member);

        return $this->logout($request);
    }

    public function logout(Request $request): Response
    {
        Auth::guard('member')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->noContent();
    }

    private function profile(Member $member): JsonResponse
    {
        return (new MemberResource($member))->response()->setStatusCode(200);
    }
}
