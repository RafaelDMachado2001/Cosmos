<?php

declare(strict_types=1);

namespace App\Modules\Content\Contracts;

interface PublicationEngagement
{
    /**
     * @param  array<int>  $publicationIds
     * @return array<int, Engagement>
     */
    public function forPublications(array $publicationIds): array;
}
