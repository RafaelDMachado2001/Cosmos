<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Publication;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FallbackTest extends TestCase
{
    use RefreshDatabase;

    public function test_publicacao_que_existe_no_banco_responde_200_com_noindex(): void
    {
        $publication = Publication::create([
            'slug' => 'ainda-nao-no-disco',
            'category' => 'artigo',
            'published_at' => now(),
            'featured' => false,
            'status' => Publication::STATUS_PUBLISHED,
        ]);
        $publication->translations()->create([
            'locale' => 'pt',
            'title' => 'Ainda nao no disco',
            'summary' => 'Resumo.',
            'body' => "Primeiro paragrafo.\n\nSegundo paragrafo.",
        ]);

        $response = $this->get('/pt/publicacoes/ainda-nao-no-disco');

        $response->assertOk();
        $response->assertSee('Ainda nao no disco');
        $response->assertSee('Primeiro paragrafo.');
        $response->assertSee('noindex', false);
        // O caminho de excecao nao afirma canonical: uma segunda implementacao
        // de SEO e como o canonical errado nasce.
        $response->assertDontSee('rel="canonical"', false);
    }

    public function test_slug_que_nao_existe_responde_404(): void
    {
        $this->get('/pt/publicacoes/nao-existe')->assertNotFound();
    }

    public function test_rascunho_nao_vaza_pelo_fallback(): void
    {
        $publication = Publication::create([
            'slug' => 'rascunho',
            'category' => 'artigo',
            'published_at' => now(),
            'featured' => false,
            'status' => Publication::STATUS_DRAFT,
        ]);
        $publication->translations()->create([
            'locale' => 'pt',
            'title' => 'Rascunho',
            'summary' => 'Resumo.',
            'body' => 'Texto.',
        ]);

        $this->get('/pt/publicacoes/rascunho')->assertNotFound();
    }

    public function test_o_segmento_do_outro_idioma_responde_404(): void
    {
        $publication = Publication::create([
            'slug' => 'cruzado',
            'category' => 'artigo',
            'published_at' => now(),
            'featured' => false,
            'status' => Publication::STATUS_PUBLISHED,
        ]);
        $publication->translations()->create([
            'locale' => 'pt',
            'title' => 'Cruzado',
            'summary' => 'Resumo.',
            'body' => 'Texto.',
        ]);

        $this->get('/pt/publications/cruzado')->assertNotFound();
    }

    public function test_a_raiz_do_laravel_nao_responde(): void
    {
        // A home é o site estático. Pelo Nginx, /index.php chegava aqui e
        // mostrava a página de boas-vindas do framework com 200: uma URL a
        // mais para o buscador e um cartão de visita da stack.
        $this->get('/')->assertNotFound();
    }
}
