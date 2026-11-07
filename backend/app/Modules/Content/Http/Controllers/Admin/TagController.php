<?php

declare(strict_types=1);

namespace App\Modules\Content\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Modules\Content\Models\PublicationTranslation;
use App\Modules\Content\Models\Tag;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class TagController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $locale = $request->validate([
            'locale' => ['required', Rule::in(PublicationTranslation::locales())],
        ])['locale'];

        $q = trim((string) $request->query('q', ''));

        $tags = Tag::query()
            ->where('locale', $locale)
            ->has('publications')
            ->when($q !== '', fn ($query) => $query->where('slug', 'like', '%'.$q.'%'))
            ->orderBy('slug')
            ->limit(20)
            ->pluck('slug');

        return response()->json($tags);
    }
}
