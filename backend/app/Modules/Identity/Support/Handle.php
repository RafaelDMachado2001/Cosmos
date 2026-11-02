<?php

declare(strict_types=1);

namespace App\Modules\Identity\Support;

use App\Modules\Identity\Models\Member;
use Illuminate\Support\Str;

final class Handle
{
    public const PATTERN = '/^[a-z0-9_]{3,30}$/';

    private const RESERVED = ['admin', 'api', 'cosmos', 'rdm', 'rdmlabs', 'root', 'staff', 'suporte', 'support'];

    public static function isValid(string $handle): bool
    {
        return preg_match(self::PATTERN, $handle) === 1 && ! in_array($handle, self::RESERVED, true);
    }

    public static function base(string $name, ?string $email = null): string
    {
        foreach ([$name, (string) Str::before((string) $email, '@')] as $source) {
            $handle = substr(trim((string) preg_replace('/[^a-z0-9]+/', '_', Str::lower(Str::ascii($source))), '_'), 0, 24);

            if (strlen($handle) >= 3) {
                return $handle;
            }
        }

        return 'leitor';
    }

    public static function unique(string $name, ?string $email = null): string
    {
        $base = self::base($name, $email);

        for ($n = 1; ; $n++) {
            $candidate = $n === 1 ? $base : $base.$n;

            if (self::isValid($candidate) && ! Member::withTrashed()->where('handle', $candidate)->exists()) {
                return $candidate;
            }
        }
    }
}
