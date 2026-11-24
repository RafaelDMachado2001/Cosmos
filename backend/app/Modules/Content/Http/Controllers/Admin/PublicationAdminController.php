<?php

declare(strict_types=1);

namespace App\Modules\Content\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Modules\Content\Contracts\Engagement;
use App\Modules\Content\Contracts\PublicationEngagement;
use App\Modules\Content\Http\Resources\Admin\PublicationAdminResource;
use App\Modules\Content\Models\Publication;
use App\Modules\Content\Models\PublicationDraft;
use App\Modules\Content\Models\PublicationTranslation;
use App\Modules\Content\Models\Tag;
use App\Modules\Content\Rules\ValidDraftBlocks;
use App\Modules\Content\Support\DraftBlocksCli;
use App\Modules\Content\Support\PublicationLock;
use App\Modules\Content\Support\PublicationVersion;
use Closure;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PublicationAdminController extends Controller
{
    private const string SLUG_REGEX = '/^[a-z0-9]+(?:-[a-z0-9]+)*$/';

    public function index(): AnonymousResourceCollection
    {
        $publications = Publication::with(['drafts', 'tags', 'references'])
            ->orderByDesc('published_at')
            ->get();
        $engagement = app(PublicationEngagement::class)->forPublications($publications->pluck('id')->all());

        return PublicationAdminResource::collection($publications->map(
            fn (Publication $publication): PublicationAdminResource => (new PublicationAdminResource($publication))
                ->withEngagement($engagement[$publication->id] ?? Engagement::none()),
        ));
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

        return DB::transaction(function () use ($data): PublicationAdminResource {
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

            return self::stored($publication);
        });
    }

    public function update(Request $request, Publication $publication): PublicationAdminResource
    {
        $ifMatch = trim((string) $request->header('If-Match'));
        // "*" não diz qual versão o cliente leu, então não protege nada.
        abort_if($ifMatch === '' || $ifMatch === '*', 428, 'Envie em If-Match a ETag da versão que você leu.');

        $locales = PublicationTranslation::locales();

        $data = $request->validate([
            'slug' => ['sometimes', 'string', 'max:255', Rule::unique('publications', 'slug')->ignore($publication), 'regex:'.self::SLUG_REGEX],
            'category' => ['sometimes', Rule::in(Publication::categories())],
            'publishedAt' => ['sometimes', 'date'],
            'featured' => ['sometimes', 'boolean'],
            'indexable' => ['sometimes', 'boolean'],
            'appearance' => ['sometimes', 'nullable', 'array'],
            'appearance.nebula' => ['required_with:appearance', 'numeric', 'between:0,1.6'],
            'appearance.motion' => ['required_with:appearance', 'boolean'],
            'tags' => ['sometimes', 'array:'.implode(',', $locales)],
            'tags.*' => ['array'],
            'tags.*.*' => ['string', 'max:255', 'regex:'.self::SLUG_REGEX],
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

        return self::locked($publication, function (Publication $locked) use ($data, $ifMatch): PublicationAdminResource {
            abort_unless(
                PublicationVersion::matches($locked, $ifMatch),
                412,
                'A publicação mudou desde a versão informada. Leia de novo antes de gravar.',
            );

            $this->apply($locked, $data);

            return self::stored($locked);
        });
    }

    /** @param  array<string, mixed>  $data */
    private function apply(Publication $publication, array $data): void
    {
        $publication->fill(array_filter([
            'slug' => $data['slug'] ?? null,
            'category' => $data['category'] ?? null,
            'published_at' => $data['publishedAt'] ?? null,
            'featured' => $data['featured'] ?? null,
            'indexable' => $data['indexable'] ?? null,
        ], fn (mixed $value): bool => $value !== null));

        if (array_key_exists('appearance', $data)) {
            $publication->appearance = $data['appearance'] === null ? null : [
                'nebula' => (float) $data['appearance']['nebula'],
                'motion' => (bool) $data['appearance']['motion'],
            ];
        }

        $publication->save();

        if (array_key_exists('tags', $data)) {
            foreach ($data['tags'] as $locale => $slugs) {
                $this->syncTags($publication, $locale, $slugs);
            }
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
                if (! in_array($locale, PublicationTranslation::locales(), true)) {
                    continue;
                }

                $publication->drafts()->updateOrCreate(
                    ['locale' => $locale],
                    array_filter([
                        'title' => $draft['title'] ?? null,
                        'subtitle' => $draft['subtitle'] ?? null,
                        'blocks' => isset($draft['blocks']) ? ValidDraftBlocks::normalizeTables($draft['blocks']) : null,
                        'seo_title' => $draft['seoTitle'] ?? null,
                        'seo_description' => $draft['seoDescription'] ?? null,
                    ], fn (mixed $value): bool => $value !== null),
                );
            }
        }
    }

    public function destroy(Publication $publication): JsonResponse
    {
        $publication->delete();

        return response()->json(null, 204);
    }

    public function publish(Publication $publication): PublicationAdminResource
    {
        return self::locked($publication, function (Publication $locked): PublicationAdminResource {
            $this->copyDraftsToTranslations($locked);

            return self::stored($locked);
        });
    }

    private function copyDraftsToTranslations(Publication $publication): void
    {
        $publication->load('drafts');

        $pt = $publication->drafts->firstWhere('locale', 'pt');

        if ($pt === null || trim((string) $pt->title) === '' || $pt->blocks === []) {
            throw ValidationException::withMessages([
                'pt' => ['A publicação precisa de título e conteúdo em português antes de publicar.'],
            ]);
        }

        $publishable = $publication->drafts->reject(
            fn (PublicationDraft $draft): bool => trim((string) $draft->title) === '' || $draft->blocks === [],
        );

        foreach ($publishable as $draft) {
            $errors = DraftBlocksCli::diagramErrors($draft->blocks);

            if ($errors !== []) {
                throw ValidationException::withMessages([
                    "drafts.{$draft->locale}.blocks" => array_column($errors, 'message'),
                ]);
            }
        }

        foreach ($publishable as $draft) {
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
        $publication->content_published_at = now()->toImmutable();
        $publication->save();
    }

    public function unpublish(Publication $publication): PublicationAdminResource
    {
        return self::locked($publication, function (Publication $locked): PublicationAdminResource {
            $locked->update(['status' => Publication::STATUS_DRAFT]);

            return self::stored($locked);
        });
    }

    /** @param  Closure(Publication): PublicationAdminResource  $write */
    private static function locked(Publication $publication, Closure $write): PublicationAdminResource
    {
        return PublicationLock::run($publication->id, $write)
            ?? throw (new ModelNotFoundException)->setModel(Publication::class, [$publication->id]);
    }

    /** Relê do banco, ainda sob o lock: a ETag devolvida é a que o próximo GET calcula. */
    private static function stored(Publication $publication): PublicationAdminResource
    {
        $publication->refresh()->load(['drafts', 'tags', 'references']);

        return new PublicationAdminResource($publication);
    }

    /** @param  list<string>  $slugs */
    private function syncTags(Publication $publication, string $locale, array $slugs): void
    {
        $ids = array_map(
            fn (string $slug): int => Tag::firstOrCreate(['locale' => $locale, 'slug' => $slug])->id,
            $slugs,
        );

        $publication->tags()->detach(
            $publication->tags()->where('tags.locale', $locale)->whereNotIn('tags.id', $ids)->pluck('tags.id'),
        );
        $publication->tags()->syncWithoutDetaching($ids);
    }
}
