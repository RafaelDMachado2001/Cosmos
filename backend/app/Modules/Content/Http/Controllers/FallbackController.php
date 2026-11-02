<?php

declare(strict_types=1);

namespace App\Modules\Content\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Content\Models\Publication;
use Illuminate\Contracts\View\View;
use Illuminate\Support\Facades\Log;

class FallbackController extends Controller
{
    public function show(string $locale, string $segment, string $slug): View
    {
        abort_unless($segment === ($locale === 'pt' ? 'publicacoes' : 'publications'), 404);

        Log::warning('fallback @app alcancado', ['locale' => $locale, 'slug' => $slug]);

        $publication = Publication::query()
            ->where('slug', $slug)
            ->where('status', Publication::STATUS_PUBLISHED)
            ->firstOrFail();

        $translation = $publication->translations()
            ->where('locale', $locale)
            ->firstOrFail();

        return view('fallback', [
            'locale' => $locale,
            'title' => $translation->title,
            'paragraphs' => preg_split('/\n\s*\n/', trim((string) $translation->body)) ?: [],
        ]);
    }
}
