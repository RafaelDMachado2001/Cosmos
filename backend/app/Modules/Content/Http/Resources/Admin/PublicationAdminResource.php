<?php

declare(strict_types=1);

namespace App\Modules\Content\Http\Resources\Admin;

use App\Modules\Content\Models\Publication;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PublicationAdminResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->id,
            'slug' => $this->resource->slug,
            'category' => $this->resource->category,
            'publishedAt' => $this->resource->published_at->toIso8601ZuluString('millisecond'),
            'featured' => (bool) $this->resource->featured,
            'indexable' => (bool) $this->resource->indexable,
            'appearance' => $this->resource->appearance,
            'status' => $this->resource->status,
            'pendingChanges' => $this->pendingChanges(),
            'tags' => $this->resource->tags->pluck('slug')->values(),
            'references' => PublicationReferenceResource::collection($this->resource->references),
            'drafts' => $this->resource->drafts
                ->keyBy('locale')
                ->map(fn ($draft) => new PublicationDraftResource($draft)),
        ];
    }

    private function pendingChanges(): bool
    {
        if ($this->resource->status === Publication::STATUS_DRAFT) {
            return false;
        }

        $publishedAt = $this->resource->content_published_at;
        if ($publishedAt === null) {
            return true;
        }

        return $this->resource->drafts->contains(
            fn ($draft) => $draft->updated_at !== null && $draft->updated_at->greaterThan($publishedAt),
        );
    }
}
