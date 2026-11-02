<?php

declare(strict_types=1);

namespace App\Modules\Identity\Auth;

use Illuminate\Support\Str;
use Laravel\Socialite\AbstractUser;
use Laravel\Socialite\Contracts\User as SocialiteUser;

final readonly class ProviderProfile
{
    public const PROVIDERS = ['google', 'github'];

    public function __construct(
        public string $provider,
        public string $id,
        public string $name,
        public ?string $email,
        public bool $emailVerified,
        public ?string $avatar,
    ) {}

    public static function from(string $provider, SocialiteUser $user): self
    {
        $raw = $user instanceof AbstractUser ? $user->getRaw() : [];
        $email = $user->getEmail();

        $verified = match ($provider) {
            'google' => ($raw['email_verified'] ?? $raw['verified_email'] ?? false) === true,
            'github' => $email !== null,
            default => false,
        };

        $name = trim((string) ($user->getName() ?: $user->getNickname()));

        return new self(
            provider: $provider,
            id: (string) $user->getId(),
            name: $name !== '' ? Str::limit($name, 80, '') : 'Leitor',
            email: $email !== null ? Str::lower($email) : null,
            emailVerified: $verified,
            avatar: $user->getAvatar(),
        );
    }
}
