<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;

/**
 * A publicação com o texto.
 *
 * O corpo sai daqui já dividido em parágrafos. O banco guarda um `text` só, mas
 * quem sabe em que formato ele foi guardado é o servidor — a constelação sempre
 * falou em parágrafos e não vai passar a falar em markdown por causa de onde o
 * dado mora.
 */
class PublicationDetailResource extends PublicationResource
{
    public function toArray(Request $request): array
    {
        return [
            ...parent::toArray($request),
            'body' => self::paragraphs($this->resource->body),
        ];
    }

    /** @return list<string> */
    public static function paragraphs(string $body): array
    {
        $parts = preg_split("/\r?\n\s*\r?\n/", trim($body)) ?: [];

        return array_values(array_filter(array_map(trim(...), $parts), fn (string $p): bool => $p !== ''));
    }
}
