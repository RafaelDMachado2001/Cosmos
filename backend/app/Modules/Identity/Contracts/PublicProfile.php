<?php

declare(strict_types=1);

namespace App\Modules\Identity\Contracts;

final readonly class PublicProfile
{
    public function __construct(
        public string $name,
        public string $handle,
        public ?string $avatarUrl,
    ) {}

    /** @return array{name: string, handle: string, avatarUrl: string|null} */
    public function toArray(): array
    {
        return ['name' => $this->name, 'handle' => $this->handle, 'avatarUrl' => $this->avatarUrl];
    }
}
