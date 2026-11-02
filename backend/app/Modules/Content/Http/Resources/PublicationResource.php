<?php

declare(strict_types=1);

namespace App\Modules\Content\Http\Resources;

use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PublicationResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'slug' => $this->resource->slug,
            'category' => $this->resource->category,
            'published_at' => $this->resource->published_at->toIso8601ZuluString('millisecond'),
            'updated_at' => $this->updatedAt()->toIso8601ZuluString('millisecond'),
            'featured' => (bool) $this->resource->featured,
            'indexable' => (bool) $this->resource->indexable,
            'title' => $this->resource->title,
            'summary' => $this->resource->summary,
        ];
    }

    private function updatedAt(): Carbon
    {
        $translationUpdatedAt = Carbon::parse($this->resource->translation_updated_at);

        return $translationUpdatedAt->greaterThan($this->resource->updated_at)
            ? $translationUpdatedAt
            : Carbon::parse($this->resource->updated_at);
    }
}
