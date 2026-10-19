<?php

declare(strict_types=1);

namespace App\Modules\Identity\Auth;

use Illuminate\Support\Str;
use Laravel\Socialite\AbstractUser;
use Laravel\Socialite\Contracts\User as SocialiteUser;

/**
 * O que o login social precisa de um provedor, já com a regra de cada um
 * aplicada: o e-mail só conta como verificado quando o provedor diz que é.
 */
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
            // Com o escopo user:email (o padrão do Socialite), o e-mail do
            // GitHub vem sempre de /user/emails e só quando é o primário e
            // verificado; o do perfil público é descartado. Nulo = não há.
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
