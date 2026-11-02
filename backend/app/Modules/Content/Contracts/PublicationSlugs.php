<?php

declare(strict_types=1);

namespace App\Modules\Content\Contracts;

interface PublicationSlugs
{
    /**
     * @param  array<int>  $publicationIds
     * @return array<int, string>
     */
    public function forIds(array $publicationIds): array;
}
