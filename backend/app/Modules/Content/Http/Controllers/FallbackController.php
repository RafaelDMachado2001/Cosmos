<?php

declare(strict_types=1);

namespace App\Modules\Content\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Content\Models\Publication;
use Illuminate\Contracts\View\View;
use Illuminate\Support\Facades\Log;

/**
 * A casca de exceção, servida quando o arquivo ainda não está no disco.
 *
 * Alcançar este controller significa que o pipeline de publicação falhou ou
 * ainda não terminou. O `Log::warning` existe para que isso apareça em algum
 * lugar em vez de virar um 200 silencioso e permanente.
 */
class FallbackController extends Controller
{
    public function show(string $locale, string $segment, string $slug): View
    {
        // Laravel entrega os parâmetros na ordem do padrão da rota, então o
        // `$segment` precisa estar na assinatura: sem ele, `$slug` receberia
        // "publicacoes" e toda busca falharia.
        //
        // O par idioma/segmento é validado aqui e não no `where` da rota: o
        // cruzamento /pt/publications/... casa no padrão e precisa dar 404, que
        // é o que a fase 6 comprou ao tirar o fallback para index.html.
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
            // Mesma divisão que a API faz: linha em branco separa parágrafo.
            'paragraphs' => preg_split('/\n\s*\n/', trim((string) $translation->body)) ?: [],
        ]);
    }
}
