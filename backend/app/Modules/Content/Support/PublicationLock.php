<?php

declare(strict_types=1);

namespace App\Modules\Content\Support;

use App\Modules\Content\Models\Publication;
use Closure;
use Illuminate\Support\Facades\DB;

final class PublicationLock
{
    private const int DEADLOCK_ATTEMPTS = 3;

    /**
     * Roda a escrita numa transação, com a linha da publicação travada e relida.
     * A escrita pode ser repetida em caso de deadlock. Null quando a publicação não existe mais.
     *
     * @template T
     *
     * @param  Closure(Publication): T  $write
     * @return T|null
     */
    public static function run(int $id, Closure $write): mixed
    {
        return DB::transaction(function () use ($id, $write): mixed {
            $publication = self::acquire($id);

            return $publication === null ? null : $write($publication);
        }, self::DEADLOCK_ATTEMPTS);
    }

    /** Para quem já abriu a própria transação. */
    public static function acquire(int $id): ?Publication
    {
        return Publication::query()->whereKey($id)->lockForUpdate()->first();
    }
}
