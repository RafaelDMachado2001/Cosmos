<?php

declare(strict_types=1);

namespace App\Modules\Content\Support;

use App\Modules\Content\Models\Publication;
use App\Modules\Content\Models\PublicationDraft;
use App\Modules\Content\Models\PublicationReference;
use App\Modules\Content\Models\Tag;

/**
 * Versão do que o Studio edita. É um hash do conteúdo, não um contador: qualquer
 * gravador que mude esses dados muda a versão, mesmo sem conhecer esta classe.
 */
final class PublicationVersion
{
    /** Espera atributos vindos do banco: valores em memória podem ter precisão diferente. */
    public static function etag(Publication $publication): string
    {
        $publication = (clone $publication)->loadMissing(['drafts', 'tags', 'references']);

        $state = [
            'id' => $publication->id,
            'slug' => $publication->slug,
            'category' => $publication->category,
            'publishedAt' => $publication->published_at->toIso8601ZuluString('microsecond'),
            'featured' => $publication->featured,
            'indexable' => $publication->indexable,
            'appearance' => $publication->appearance,
            'status' => $publication->status,
            'contentPublishedAt' => $publication->content_published_at?->toIso8601ZuluString('microsecond'),
            'tags' => $publication->tags
                ->map(fn (Tag $tag): string => "{$tag->locale}:{$tag->slug}")
                ->sort()->values()->all(),
            'references' => $publication->references
                ->sortBy('position')
                ->map(fn (PublicationReference $reference): array => [$reference->title, $reference->url])
                ->values()->all(),
            'drafts' => $publication->drafts
                ->sortBy('locale')
                ->map(fn (PublicationDraft $draft): array => [
                    $draft->locale,
                    $draft->title,
                    $draft->subtitle,
                    $draft->blocks,
                    $draft->seo_title,
                    $draft->seo_description,
                ])
                ->values()->all(),
        ];

        return '"'.hash('sha256', json_encode($state, JSON_THROW_ON_ERROR | JSON_PRESERVE_ZERO_FRACTION)).'"';
    }

    /** Comparação forte (RFC 9110): uma ETag fraca (W/"...") nunca casa. */
    public static function matches(Publication $publication, string $ifMatch): bool
    {
        return in_array(self::etag($publication), array_map(trim(...), explode(',', $ifMatch)), true);
    }
}
