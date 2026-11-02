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

final class SignInWithProvider
{
    public function handle(ProviderProfile $profile, string $locale): Member
    {
        if (! $profile->emailVerified || $profile->email === null) {
            throw new InvalidArgumentException('e-mail não verificado pelo provedor');
        }

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
