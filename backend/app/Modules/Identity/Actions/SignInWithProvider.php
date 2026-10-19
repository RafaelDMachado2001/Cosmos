<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Auth\ProviderProfile;
use App\Modules\Identity\Events\MemberRegistered;
use App\Modules\Identity\Models\Member;
use App\Modules\Identity\Models\MemberIdentity;
use App\Modules\Identity\Support\Handle;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * Acha ou cria o membro de um login social.
 *
 * 1. A identidade (provedor + id do provedor) já existe: é aquele membro.
 * 2. Outro provedor já trouxe o mesmo e-mail: liga a este membro (D5). Só
 *    e-mails verificados chegam ao banco, então os dois lados verificaram.
 * 3. Senão, conta nova, e o evento MemberRegistered.
 */
final class SignInWithProvider
{
    public function handle(ProviderProfile $profile, string $locale): Member
    {
        if (! $profile->emailVerified || $profile->email === null) {
            throw new InvalidArgumentException('e-mail não verificado pelo provedor');
        }

        // Dois callbacks ao mesmo tempo (duplo clique, duas abas) disputam o
        // handle ou a identidade; quem perde tenta de novo e acha o vencedor.
        for ($attempt = 1; ; $attempt++) {
            try {
                return $this->attempt($profile, $locale);
            } catch (UniqueConstraintViolationException $e) {
                if ($attempt === 3) {
                    throw $e;
                }
            }
        }
    }

    private function attempt(ProviderProfile $profile, string $locale): Member
    {
        $identity = MemberIdentity::query()
            ->where('provider', $profile->provider)
            ->where('provider_user_id', $profile->id)
            ->first();

        if ($identity !== null) {
            return $identity->member()->firstOrFail();
        }

        [$member, $created] = DB::transaction(function () use ($profile, $locale): array {
            $member = Member::query()->where('email', $profile->email)->first();
            $created = $member === null;

            $member ??= Member::create([
                'name' => $profile->name,
                'handle' => Handle::unique($profile->name, $profile->email),
                'avatar_url' => $profile->avatar,
                'email' => $profile->email,
                'email_verified_at' => now(),
                'locale' => $locale,
            ]);

            $member->identities()->create([
                'provider' => $profile->provider,
                'provider_user_id' => $profile->id,
            ]);

            return [$member, $created];
        });

        if ($created) {
            MemberRegistered::dispatch($member->id, $profile->provider);
        }

        return $member;
    }
}
