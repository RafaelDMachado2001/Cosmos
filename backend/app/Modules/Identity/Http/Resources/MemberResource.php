<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Resources;

use App\Modules\Identity\Models\Member;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * O perfil do próprio leitor. O e-mail aparece só aqui, para o dono.
 *
 * @mixin Member
 */
class MemberResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'handle' => $this->handle,
            'avatarUrl' => $this->avatar_url,
            'email' => $this->email,
            'locale' => $this->locale,
            'providers' => $this->identities()->pluck('provider')->values(),
            'createdAt' => $this->created_at->toIso8601String(),
        ];
    }
}
