<?php

declare(strict_types=1);

namespace App\Modules\Community\Http;

use App\Modules\Content\Contracts\PublishedPublications;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final readonly class PublicationTarget
{
    private function __construct(
        public int $id,
        public string $locale,
    ) {}

    public static function fromRequest(Request $request, string $slug): self
    {
        $validated = $request->validate([
            'locale' => ['sometimes', 'string', Rule::in((array) config('publications.locales'))],
        ]);
        $locale = (string) ($validated['locale'] ?? 'pt');

        $id = app(PublishedPublications::class)->idFor($slug, $locale);
        abort_if($id === null, 404);

        return new self($id, $locale);
    }
}
