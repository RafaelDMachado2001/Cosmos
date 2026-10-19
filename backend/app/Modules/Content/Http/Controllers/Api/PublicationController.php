<?php

declare(strict_types=1);

namespace App\Modules\Content\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Content\Http\Resources\PublicationDetailResource;
use App\Modules\Content\Http\Resources\PublicationResource;
use App\Modules\Content\Models\Publication;
use App\Modules\Content\Models\PublicationTranslation;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class PublicationController extends Controller
{
    /** Sem `limit`, devolve até isto. A paginação real é por janela temporal. */
    private const int DEFAULT_LIMIT = 100;

    private const string DEFAULT_LOCALE = 'pt';

    public function index(Request $request): AnonymousResourceCollection
    {
        $input = $this->validated($request, [
            'category' => ['sometimes', Rule::in(Publication::categories())],
            'q' => ['sometimes', 'string', 'max:200'],
            'before' => ['sometimes', 'date'],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:1000'],
        ]);

        $locale = $input['locale'];
        // A query string entrega texto; o contrato de `meta.limit` e inteiro.
        $limit = (int) ($input['limit'] ?? self::DEFAULT_LIMIT);

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
                    // O dicionario de cada idioma, como na coluna gerada.
                    [config('publications.dictionaries')[$locale], $input['q']]
                )
            )
            ->orderByDesc('publications.published_at')
            // Pede uma a mais do que cabe: e assim que se sabe que havia mais sem
            // pagar um segundo count() sobre o join.
            ->limit($limit + 1)
            ->get();

        $truncated = $publications->count() > $limit;
        $publications = $publications->take($limit);

        // Cortar sem avisar publicava metade do acervo em silencio. O prerender
        // le `truncated` e prefere um build vermelho a um site pela metade.
        return PublicationResource::collection($publications)->additional([
            'meta' => [
                'count' => $publications->count(),
                'limit' => $limit,
                'truncated' => $truncated,
            ],
        ]);
    }

    public function show(Request $request, string $slug): PublicationDetailResource
    {
        $input = $this->validated($request, []);

        $publication = $this->published($input['locale'])
            ->addSelect(['publications.id', 'translation.body', 'translation.seo_title', 'translation.seo_description'])
            ->where('publications.slug', $slug)
            ->first();

        // 404 e não uma publicação vazia: o adapter do frontend distingue os
        // dois, e "não existe" tem tela própria enquanto "falhou" tem outra.
        abort_if($publication === null, 404);

        // Os idiomas em que o artigo existe, na ordem do vocabulário. É o que o
        // cliente precisa para o hreflang: sem isto ele assumia os dois, e o
        // DOM renderizado apontava para uma tradução que dava 404.
        $translated = PublicationTranslation::where('publication_id', $publication->id)->pluck('locale')->all();
        $publication->setAttribute('locales', array_values(array_intersect(config('publications.locales'), $translated)));

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
    /** @return Builder<Publication> */
    private function published(string $locale): Builder
    {
        return Publication::query()
            ->select([
                'publications.slug',
                'publications.category',
                'publications.published_at',
                'publications.updated_at',
                'publications.featured',
                'publications.indexable',
                'translation.title',
                'translation.summary',
                'translation.updated_at as translation_updated_at',
            ])
            ->join('publication_translations as translation', function ($join) use ($locale): void {
                $join->on('translation.publication_id', '=', 'publications.id')
                    ->where('translation.locale', '=', $locale);
            })
            ->where('publications.status', Publication::STATUS_PUBLISHED)
            // Sem isto, "Publicado" com data futura aparecia na hora. A
            // publicacao agendada so vira elegivel quando a data chega — ver
            // o comando `publications:publish-scheduled`, que e quem nota a
            // mudanca e manda regenerar o site.
            ->where('publications.published_at', '<=', now());
    }

    /**
     * @param  array<string, array<int, mixed>>  $rules
     * @return array<string, mixed>
     */
    private function validated(Request $request, array $rules): array
    {
        $input = $request->validate([
            'locale' => ['sometimes', Rule::in(PublicationTranslation::locales())],
            ...$rules,
        ]);

        $input['locale'] = $input['locale'] ?? self::DEFAULT_LOCALE;

        return $input;
    }
}
