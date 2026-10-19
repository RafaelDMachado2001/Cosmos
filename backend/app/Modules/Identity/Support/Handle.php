<?php

declare(strict_types=1);

namespace App\Modules\Identity\Support;

use App\Modules\Identity\Models\Member;
use Illuminate\Support\Str;

/**
 * O `@handle` público de um membro: minúsculo, `[a-z0-9_]`, de 3 a 30.
 *
 * Nasce do nome (ou do e-mail, se o nome não render nada) e, quando já
 * existe, ganha sufixo numérico: `ana`, `ana2`, `ana3`. Contas desativadas
 * contam. A exceção é a conta apagada a pedido do dono (DeleteMember): o
 * handle é dado pessoal, vira aleatório e o antigo fica livre.
 */
final class Handle
{
    public const PATTERN = '/^[a-z0-9_]{3,30}$/';

    /** Endereços que alguém poderia usar para se passar pelo site. */
    private const RESERVED = ['admin', 'api', 'cosmos', 'rdm', 'rdmlabs', 'root', 'staff', 'suporte', 'support'];

    public static function isValid(string $handle): bool
    {
        return preg_match(self::PATTERN, $handle) === 1 && ! in_array($handle, self::RESERVED, true);
    }

    /** O handle base, ainda sem checar se está livre. */
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

    /** O primeiro de `base`, `base2`, `base3`... que ninguém tem. */
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
