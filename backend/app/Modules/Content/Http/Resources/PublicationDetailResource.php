<?php

declare(strict_types=1);

namespace App\Modules\Content\Http\Resources;

use Illuminate\Http\Request;

class PublicationDetailResource extends PublicationResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            ...parent::toArray($request),
            'body' => $this->resource->body,
            'seo_title' => $this->resource->seo_title,
            'seo_description' => $this->resource->seo_description,
            'locales' => $this->resource->locales,
            'tags' => $this->resource->getAttribute('tags'),
            'appearance' => $this->resource->appearance,
        ];
    }
}
