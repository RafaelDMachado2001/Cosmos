<?php

declare(strict_types=1);

namespace App\Http\Resources;

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
    public function toArray(Request $request): array
    {
        return [
            'slug' => $this->resource->slug,
            'category' => $this->resource->category,
            'published_at' => $this->resource->published_at->toIso8601ZuluString('millisecond'),
            'featured' => (bool) $this->resource->featured,
            'title' => $this->resource->title,
            'summary' => $this->resource->summary,
        ];
    }
}
