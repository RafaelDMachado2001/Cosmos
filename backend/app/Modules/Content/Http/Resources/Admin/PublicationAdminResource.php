<?php

declare(strict_types=1);

namespace App\Modules\Content\Http\Resources\Admin;

use App\Modules\Content\Contracts\Engagement;
use App\Modules\Content\Contracts\PublicationEngagement;
use App\Modules\Content\Models\Publication;
use App\Modules\Content\Models\PublicationTranslation;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PublicationAdminResource extends JsonResource
{
    private ?Engagement $engagement = null;

    public function withEngagement(Engagement $engagement): static
    {
        $this->engagement = $engagement;

        return $this;
    }

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
            'engagement' => ($this->engagement ?? $this->loadEngagement())->toArray(),
            'tags' => $this->tagsByLocale(),
            'references' => PublicationReferenceResource::collection($this->resource->references),
            'drafts' => $this->resource->drafts
                ->keyBy('locale')
                ->map(fn ($draft) => new PublicationDraftResource($draft)),
        ];
    }

    private function loadEngagement(): Engagement
    {
        $id = $this->resource->id;

        return app(PublicationEngagement::class)->forPublications([$id])[$id] ?? Engagement::none();
    }

    /** @return array<string, list<string>> */
    private function tagsByLocale(): array
    {
        $tags = [];

        foreach (PublicationTranslation::locales() as $locale) {
            $tags[$locale] = $this->resource->tags->where('locale', $locale)->pluck('slug')->all();
        }

        return $tags;
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
