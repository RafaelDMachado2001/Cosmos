<?php

declare(strict_types=1);

namespace App\Modules\Content\Contracts;

interface PublishedPublications
{
    public function idFor(string $slug, string $locale): ?int;
}
