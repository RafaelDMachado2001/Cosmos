<?php

declare(strict_types=1);

namespace App\Modules\Content\Http\Resources\Admin;

use App\Modules\Content\Models\Publication;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A forma que o RDM Studio consome — sempre com o conteúdo de trabalho
 * completo (os rascunhos têm no máximo duas traduções, nunca justifica uma
 * versão "leve" separada como a API pública tem).
 */
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
            'status' => $this->resource->status,
            'pendingChanges' => $this->pendingChanges(),
            'tags' => $this->resource->tags->pluck('slug')->values(),
            'references' => PublicationReferenceResource::collection($this->resource->references),
            'drafts' => $this->resource->drafts
                ->keyBy('locale')
                ->map(fn ($draft) => new PublicationDraftResource($draft)),
        ];
    }

    /**
     * No ar, com rascunho editado depois da última publicação. Num rascunho
     * a pergunta não existe: nada está no ar para ficar desatualizado.
     */
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
