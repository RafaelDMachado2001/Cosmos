<?php

declare(strict_types=1);

namespace App\Modules\Content\Http\Resources;

use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A forma enxuta que a constelação consome.
 *
 * Sem o corpo do texto de propósito: são catorze estrelas hoje e centenas
 * depois, e nenhuma delas mostra o texto antes de ser aberta. `published_at` em
 * ISO 8601 porque é o que o `Date.parse` do cliente espera.
 */
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

    /**
     * O mais recente entre a publicação e a tradução pedida.
     *
     * Editar só o texto não toca `publications.updated_at` — ver "editar só a
     * tradução também regenera" na fase 9. O `sitemap.xml` do cliente usa isto
     * como `lastmod`; sem o maior dos dois, uma edição de texto nunca mudaria
     * a data que o buscador vê.
     */
    private function updatedAt(): Carbon
    {
        $translationUpdatedAt = Carbon::parse($this->resource->translation_updated_at);

        return $translationUpdatedAt->greaterThan($this->resource->updated_at)
            ? $translationUpdatedAt
            : Carbon::parse($this->resource->updated_at);
    }
}
