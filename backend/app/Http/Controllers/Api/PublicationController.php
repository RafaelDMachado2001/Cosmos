<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PublicationDetailResource;
use App\Http\Resources\PublicationResource;
use App\Models\Publication;
use App\Models\PublicationTranslation;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class PublicationController extends Controller
{
    /** Sem `limit`, devolve até isto. A paginação real é por janela temporal. */
    private const int DEFAULT_LIMIT = 100;

    private const string DEFAULT_LOCALE = 'pt';

    /** O dicionário de full-text de cada idioma, como na coluna gerada. */
    private const array DICTIONARY = ['pt' => 'portuguese', 'en' => 'english'];

    public function index(Request $request): AnonymousResourceCollection
    {
        $input = $this->validated($request, [
            'category' => ['sometimes', Rule::in(Publication::CATEGORIES)],
            'q' => ['sometimes', 'string', 'max:200'],
            'before' => ['sometimes', 'date'],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:200'],
        ]);

        $locale = $input['locale'];

        $publications = $this->published($locale)
            ->when(
                isset($input['category']),
                fn (Builder $query) => $query->where('publications.category', $input['category'])
            )
            ->when(
                isset($input['before']),
                fn (Builder $query) => $query->where('publications.published_at', '<', $input['before'])
            )
            ->when(
                isset($input['q']) && trim((string) $input['q']) !== '',
                fn (Builder $query) => $query->whereRaw(
                    'translation.search_vector @@ websearch_to_tsquery(?::regconfig, ?)',
                    [self::DICTIONARY[$locale], $input['q']]
                )
            )
            ->orderByDesc('publications.published_at')
            ->limit($input['limit'] ?? self::DEFAULT_LIMIT)
            ->get();

        return PublicationResource::collection($publications);
    }

    public function show(Request $request, string $slug): PublicationDetailResource
    {
        $input = $this->validated($request, []);

        $publication = $this->published($input['locale'])
            ->addSelect('translation.body')
            ->where('publications.slug', $slug)
            ->first();

        // 404 e não uma publicação vazia: o adapter do frontend distingue os
        // dois, e "não existe" tem tela própria enquanto "falhou" tem outra.
        abort_if($publication === null, 404);

        return new PublicationDetailResource($publication);
    }

    /**
     * A base de toda consulta pública.
     *
     * O `join` é o que resolve o idioma: uma publicação sem tradução no idioma
     * pedido simplesmente não aparece, em vez de aparecer sem título. O filtro
     * por `status` fica aqui, e não em cada método, porque esquecê-lo em um
     * deles publicaria rascunhos.
     */
    private function published(string $locale): Builder
    {
        return Publication::query()
            ->select([
                'publications.slug',
                'publications.category',
                'publications.published_at',
                'publications.featured',
                'translation.title',
                'translation.summary',
            ])
            ->join('publication_translations as translation', function ($join) use ($locale): void {
                $join->on('translation.publication_id', '=', 'publications.id')
                    ->where('translation.locale', '=', $locale);
            })
            ->where('publications.status', Publication::STATUS_PUBLISHED);
    }

    /** @param array<string, array<int, mixed>> $rules */
    private function validated(Request $request, array $rules): array
    {
        $input = $request->validate([
            'locale' => ['sometimes', Rule::in(PublicationTranslation::LOCALES)],
            ...$rules,
        ]);

        $input['locale'] = $input['locale'] ?? self::DEFAULT_LOCALE;

        return $input;
    }
}
