<?php

declare(strict_types=1);

namespace App\Modules\Content\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Modules\Content\Http\Resources\Admin\PublicationAdminResource;
use App\Modules\Content\Models\Publication;
use App\Modules\Content\Models\PublicationTranslation;
use App\Modules\Content\Models\Tag;
use App\Modules\Content\Rules\ValidDraftBlocks;
use App\Modules\Content\Support\DraftBlocksCli;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * O CRUD do RDM Studio. Nunca a API pública — aqui dentro `status` pode ser
 * qualquer um dos três valores, `body` não existe (só `publication_drafts`),
 * e nada disto é filtrado por `published_at`.
 */
class PublicationAdminController extends Controller
{
    private const string SLUG_REGEX = '/^[a-z0-9]+(?:-[a-z0-9]+)*$/';

    public function index(): AnonymousResourceCollection
    {
        return PublicationAdminResource::collection(
            Publication::with(['drafts', 'tags', 'references'])
                ->orderByDesc('published_at')
                ->get()
        );
    }

    public function show(Publication $publication): PublicationAdminResource
    {
        $publication->load(['drafts', 'tags', 'references']);

        return new PublicationAdminResource($publication);
    }

    public function store(Request $request): PublicationAdminResource
    {
        $data = $request->validate([
            'slug' => ['required', 'string', 'max:255', 'unique:publications,slug', 'regex:'.self::SLUG_REGEX],
            'category' => ['required', Rule::in(Publication::categories())],
            'publishedAt' => ['required', 'date'],
            'featured' => ['sometimes', 'boolean'],
        ]);

        $publication = Publication::create([
            'slug' => $data['slug'],
            'category' => $data['category'],
            'published_at' => $data['publishedAt'],
            'featured' => $data['featured'] ?? false,
            'indexable' => true,
            'status' => Publication::STATUS_DRAFT,
        ]);

        foreach (PublicationTranslation::locales() as $locale) {
            $publication->drafts()->create(['locale' => $locale, 'blocks' => []]);
        }

        $publication->load(['drafts', 'tags', 'references']);

        return new PublicationAdminResource($publication);
    }

    /** O autosave: qualquer subconjunto dos campos, aplicado por cima do que já existe. */
    public function update(Request $request, Publication $publication): PublicationAdminResource
    {
        $locales = PublicationTranslation::locales();

        $data = $request->validate([
            'slug' => ['sometimes', 'string', 'max:255', Rule::unique('publications', 'slug')->ignore($publication), 'regex:'.self::SLUG_REGEX],
            'category' => ['sometimes', Rule::in(Publication::categories())],
            'publishedAt' => ['sometimes', 'date'],
            'featured' => ['sometimes', 'boolean'],
            'indexable' => ['sometimes', 'boolean'],
            'tags' => ['sometimes', 'array'],
            'tags.*' => ['string', 'max:255', 'regex:'.self::SLUG_REGEX],
            'references' => ['sometimes', 'array'],
            'references.*.title' => ['required', 'string', 'max:255'],
            'references.*.url' => ['required', 'string', 'max:2048', function (string $attribute, mixed $value, Closure $fail): void {
                if (ValidDraftBlocks::safeUrl((string) $value) === null) {
                    $fail('URL precisa ser http(s), raiz-relativo ou âncora.');
                }
            }],
            'drafts' => ['sometimes', 'array'],
            'drafts.*' => ['array'],
            'drafts.*.title' => ['sometimes', 'nullable', 'string', 'max:255'],
            'drafts.*.subtitle' => ['sometimes', 'nullable', 'string', 'max:255'],
            'drafts.*.blocks' => ['sometimes', 'array', new ValidDraftBlocks],
            'drafts.*.seoTitle' => ['sometimes', 'nullable', 'string', 'max:255'],
            'drafts.*.seoDescription' => ['sometimes', 'nullable', 'string', 'max:255'],
        ]);

        $publication->fill(array_filter([
            'slug' => $data['slug'] ?? null,
            'category' => $data['category'] ?? null,
            'published_at' => $data['publishedAt'] ?? null,
            'featured' => $data['featured'] ?? null,
            'indexable' => $data['indexable'] ?? null,
        ], fn (mixed $value): bool => $value !== null))->save();

        if (array_key_exists('tags', $data)) {
            $tagIds = array_map(
                fn (string $slug): int => Tag::firstOrCreate(['slug' => $slug])->id,
                $data['tags'],
            );
            $publication->tags()->sync($tagIds);
        }

        if (array_key_exists('references', $data)) {
            $publication->references()->delete();
            foreach (array_values($data['references']) as $position => $reference) {
                $publication->references()->create([
                    'position' => $position,
                    'title' => $reference['title'],
                    'url' => $reference['url'],
                ]);
            }
        }

        if (array_key_exists('drafts', $data)) {
            foreach ($data['drafts'] as $locale => $draft) {
                if (! in_array($locale, $locales, true)) {
                    continue;
                }

                $publication->drafts()->updateOrCreate(
                    ['locale' => $locale],
                    array_filter([
                        'title' => $draft['title'] ?? null,
                        'subtitle' => $draft['subtitle'] ?? null,
                        'blocks' => $draft['blocks'] ?? null,
                        'seo_title' => $draft['seoTitle'] ?? null,
                        'seo_description' => $draft['seoDescription'] ?? null,
                    ], fn (mixed $value): bool => $value !== null),
                );
            }
        }

        $publication->load(['drafts', 'tags', 'references']);

        return new PublicationAdminResource($publication);
    }

    public function destroy(Publication $publication): JsonResponse
    {
        $publication->delete();

        return response()->json(null, 204);
    }

    /**
     * Copia cada rascunho com conteúdo para `publication_translations`,
     * serializando blocos em Markdown (`DraftBlocksCli`). `published_at` no
     * futuro vira `scheduled`, não `published` direto — é
     * `publications:publish-scheduled` quem faz a segunda transição quando a
     * data chega.
     */
    public function publish(Publication $publication): PublicationAdminResource
    {
        $publication->load('drafts');

        $pt = $publication->drafts->firstWhere('locale', 'pt');

        if ($pt === null || trim((string) $pt->title) === '' || $pt->blocks === []) {
            throw ValidationException::withMessages([
                'pt' => ['A publicação precisa de título e conteúdo em português antes de publicar.'],
            ]);
        }

        foreach ($publication->drafts as $draft) {
            if (trim((string) $draft->title) === '' || $draft->blocks === []) {
                // Um idioma sem conteúdo ainda não publica aquela tradução —
                // a publicação simplesmente não aparece lá, como sempre foi.
                continue;
            }

            $publication->translations()->updateOrCreate(
                ['locale' => $draft->locale],
                [
                    'title' => $draft->title,
                    'summary' => $draft->subtitle ?? '',
                    'body' => DraftBlocksCli::toMarkdown($draft->blocks),
                    'seo_title' => $draft->seo_title,
                    'seo_description' => $draft->seo_description,
                ],
            );
        }

        $publication->status = $publication->published_at->isFuture()
            ? Publication::STATUS_SCHEDULED
            : Publication::STATUS_PUBLISHED;
        $publication->save();

        $publication->load(['drafts', 'tags', 'references']);

        return new PublicationAdminResource($publication);
    }

    public function unpublish(Publication $publication): PublicationAdminResource
    {
        $publication->update(['status' => Publication::STATUS_DRAFT]);
        $publication->load(['drafts', 'tags', 'references']);

        return new PublicationAdminResource($publication);
    }
}
