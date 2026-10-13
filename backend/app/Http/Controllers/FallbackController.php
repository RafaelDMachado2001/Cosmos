<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Publication;
use Illuminate\Contracts\View\View;
use Illuminate\Support\Facades\Log;

/**
 * A casca de excecao, servida quando o arquivo ainda nao esta no disco.
 *
 * Alcancar este controller significa que o pipeline de publicacao falhou ou
 * ainda nao terminou. O `Log::warning` existe para que isso apareca em algum
 * lugar em vez de virar um 200 silencioso e permanente.
 */
class FallbackController extends Controller
{
    public function show(string $locale, string $segment, string $slug): View
    {
        // Laravel entrega os parametros na ordem do padrao da rota, entao o
        // `$segment` precisa estar na assinatura: sem ele, `$slug` receberia
        // "publicacoes" e toda busca falharia.
        //
        // O par idioma/segmento e validado aqui e nao no `where` da rota: o
        // cruzamento /pt/publications/... casa no padrao e precisa dar 404, que
        // e o que a fase 6 comprou ao tirar o fallback para index.html.
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
            // Mesma divisao que a API faz: linha em branco separa paragrafo.
            'paragraphs' => preg_split('/\n\s*\n/', trim((string) $translation->body)) ?: [],
        ]);
    }
}
