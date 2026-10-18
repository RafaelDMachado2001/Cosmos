<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Identity\Http\Resources\MemberResource;
use App\Modules\Identity\Models\Member;
use App\Modules\Identity\Support\Handle;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

/**
 * A conta do próprio leitor, pela sessão do Sanctum (guard `member`).
 */
class MeController extends Controller
{
    /**
     * Sem sessão, 204 e não 401: todo visitante anônimo do site pergunta, e
     * um 401 por página encheria o console de erro que não é erro.
     */
    public function show(Request $request): MemberResource|Response
    {
        $member = $request->user('sanctum');

        return $member instanceof Member ? new MemberResource($member) : response()->noContent();
    }

    public function update(Request $request): MemberResource
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

        return new MemberResource($member);
    }

    public function logout(Request $request): Response
    {
        Auth::guard('member')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->noContent();
    }
}
