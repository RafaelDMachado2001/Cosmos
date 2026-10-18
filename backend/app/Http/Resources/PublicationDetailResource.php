<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;

/**
 * A publicação com o texto.
 *
 * O corpo sai daqui como a string de Markdown crua, exatamente como o banco
 * guarda — dividir em título, parágrafo, citação, lista, código e imagem é
 * trabalho de `core/blocks.ts`, no cliente, uma vez. O servidor nunca
 * interpreta marcação; mesmo princípio do `core/seo.ts` na fase 9.
 */
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
        ];
    }
}
