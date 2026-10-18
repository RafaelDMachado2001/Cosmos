<?php

declare(strict_types=1);

namespace App\Http\Resources\Admin;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PublicationDraftResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'locale' => $this->resource->locale,
            'title' => $this->resource->title,
            'subtitle' => $this->resource->subtitle,
            'blocks' => $this->resource->blocks,
            'seoTitle' => $this->resource->seo_title,
            'seoDescription' => $this->resource->seo_description,
            'updatedAt' => $this->resource->updated_at?->toIso8601ZuluString('millisecond'),
        ];
    }
}
