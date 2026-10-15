<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Publication;
use Carbon\Carbon;
use Database\Seeders\PublicationSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublicationApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PublicationSeeder::class);
    }

    private function publish(string $slug, string $category, string $date, array $pt, array $en, string $status = Publication::STATUS_PUBLISHED): Publication
    {
        $publication = Publication::create([
            'slug' => $slug,
            'category' => $category,
            'published_at' => $date,
            'featured' => false,
            'status' => $status,
        ]);

        foreach (['pt' => $pt, 'en' => $en] as $locale => $content) {
            $publication->translations()->create([
                'locale' => $locale,
                'title' => $content[0],
                'summary' => $content[1],
                'body' => $content[2],
            ]);
        }

        return $publication;
    }

    public function test_lista_do_mais_novo_para_o_mais_antigo(): void
    {
        $response = $this->getJson('/api/publications?locale=pt')->assertOk();

        $dates = array_column($response->json('data'), 'published_at');
        $sorted = $dates;
        rsort($sorted);

        $this->assertSame($sorted, $dates);
        $this->assertCount(14, $dates);
    }

    public function test_a_lista_nao_traz_o_corpo_do_texto(): void
    {
        $first = $this->getJson('/api/publications')->assertOk()->json('data.0');

        $this->assertArrayNotHasKey('body', $first);
        $this->assertSame(
            ['slug', 'category', 'published_at', 'updated_at', 'featured', 'title', 'summary'],
            array_keys($first)
        );
    }

    public function test_rascunho_nao_chega_na_api(): void
    {
        $this->publish(
            'rascunho-secreto',
            'artigo',
            '2026-12-01T12:00:00Z',
            ['Rascunho', 'Resumo', 'Corpo'],
            ['Draft', 'Summary', 'Body'],
            Publication::STATUS_DRAFT
        );

        $slugs = array_column($this->getJson('/api/publications')->json('data'), 'slug');

        $this->assertNotContains('rascunho-secreto', $slugs);
        $this->getJson('/api/publications/rascunho-secreto')->assertNotFound();
    }

    public function test_o_idioma_troca_o_conteudo(): void
    {
        $pt = $this->getJson('/api/publications?locale=pt')->json('data.0');
        $en = $this->getJson('/api/publications?locale=en')->json('data.0');

        $this->assertSame($pt['slug'], $en['slug']);
        $this->assertNotSame($pt['title'], $en['title']);
    }

    public function test_o_idioma_padrao_e_portugues(): void
    {
        $this->assertSame(
            $this->getJson('/api/publications?locale=pt')->json('data.0.title'),
            $this->getJson('/api/publications')->json('data.0.title')
        );
    }

    public function test_filtra_por_categoria(): void
    {
        $data = $this->getJson('/api/publications?category=projeto')->assertOk()->json('data');

        $this->assertNotEmpty($data);
        foreach ($data as $item) {
            $this->assertSame('projeto', $item['category']);
        }
    }

    public function test_busca_em_portugues_com_radical(): void
    {
        // "índices" no título; a busca por "índice" precisa achar, senão a
        // pesquisa depende de a pessoa acertar a flexão.
        $slugs = array_column(
            $this->getJson('/api/publications?locale=pt&q='.urlencode('índice'))->json('data'),
            'slug'
        );

        $this->assertContains('fundamentos-de-indices-no-postgresql', $slugs);
    }

    public function test_busca_em_ingles_com_radical(): void
    {
        $slugs = array_column(
            $this->getJson('/api/publications?locale=en&q=indexes')->json('data'),
            'slug'
        );

        $this->assertContains('fundamentos-de-indices-no-postgresql', $slugs);
    }

    public function test_busca_combina_com_categoria(): void
    {
        $data = $this->getJson('/api/publications?locale=pt&category=estudo&q=shaders')->json('data');

        $this->assertSame(['shaders-glsl-para-interfaces'], array_column($data, 'slug'));
    }

    public function test_busca_sem_resultado_devolve_lista_vazia(): void
    {
        $this->getJson('/api/publications?q=zzzznaoexiste')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_pagina_por_janela_temporal(): void
    {
        $all = $this->getJson('/api/publications')->json('data');
        $cutoff = $all[2]['published_at'];

        $older = $this->getJson('/api/publications?before='.urlencode($cutoff))->json('data');

        $this->assertCount(count($all) - 3, $older);
        foreach ($older as $item) {
            $this->assertLessThan($cutoff, $item['published_at']);
        }
    }

    public function test_respeita_o_limite(): void
    {
        $this->getJson('/api/publications?limit=3')->assertOk()->assertJsonCount(3, 'data');
    }

    public function test_a_resposta_declara_count_limit_e_truncated(): void
    {
        $response = $this->getJson('/api/publications?locale=pt');

        $response->assertOk();
        $response->assertJsonPath('meta.count', 14);
        $response->assertJsonPath('meta.limit', 100);
        $response->assertJsonPath('meta.truncated', false);
    }

    public function test_truncated_fica_verdadeiro_quando_o_limite_corta(): void
    {
        $response = $this->getJson('/api/publications?locale=pt&limit=2');

        $response->assertJsonCount(2, 'data');
        $response->assertJsonPath('meta.count', 2);
        $response->assertJsonPath('meta.limit', 2);
        $response->assertJsonPath('meta.truncated', true);
    }

    public function test_limite_igual_ao_acervo_nao_e_truncamento(): void
    {
        // count === limit nao basta: so ha truncamento se havia mais linhas.
        $response = $this->getJson('/api/publications?locale=pt&limit=14');

        $response->assertJsonPath('meta.count', 14);
        $response->assertJsonPath('meta.truncated', false);
    }

    public function test_o_teto_do_limite_e_mil(): void
    {
        $this->getJson('/api/publications?locale=pt&limit=1001')->assertStatus(422);
        $this->getJson('/api/publications?locale=pt&limit=1000')->assertOk();
    }

    public function test_recusa_parametros_invalidos(): void
    {
        $this->getJson('/api/publications?locale=fr')->assertStatus(422);
        $this->getJson('/api/publications?category=inexistente')->assertStatus(422);
        $this->getJson('/api/publications?limit=0')->assertStatus(422);
        $this->getJson('/api/publications?before=nao-e-data')->assertStatus(422);
    }

    public function test_a_61a_requisicao_no_mesmo_minuto_recebe_429(): void
    {
        // O limiter 'api' e por IP, e o cliente de teste usa sempre o mesmo —
        // e exatamente o que se quer provar aqui.
        for ($i = 0; $i < 60; $i++) {
            $this->getJson('/api/publications?locale=pt')->assertOk();
        }

        $this->getJson('/api/publications?locale=pt')->assertStatus(429);
    }

    public function test_a_publicacao_traz_o_corpo_como_markdown_cru(): void
    {
        $data = $this->getJson('/api/publications/code-review-sem-atrito?locale=pt')
            ->assertOk()
            ->json('data');

        // Dividir em blocos e trabalho de core/blocks.ts, no cliente — o
        // servidor so guarda e devolve a string. Ver a spec da fase 11.
        $this->assertIsString($data['body']);
        $this->assertNotSame('', trim($data['body']));
        $this->assertStringContainsString("\n\n", $data['body']);
    }

    public function test_a_publicacao_respeita_o_idioma(): void
    {
        $pt = $this->getJson('/api/publications/code-review-sem-atrito?locale=pt')->json('data.body');
        $en = $this->getJson('/api/publications/code-review-sem-atrito?locale=en')->json('data.body');

        $this->assertNotSame($pt, $en);
    }

    public function test_slug_desconhecido_e_404(): void
    {
        $this->getJson('/api/publications/nao-existe-de-jeito-nenhum')->assertNotFound();
    }

    public function test_publicacao_agendada_nao_aparece_antes_da_data(): void
    {
        $this->publish(
            'agendada-para-o-futuro',
            'artigo',
            now()->addDay()->toIso8601String(),
            ['Futuro', 'Resumo', 'Corpo'],
            ['Future', 'Summary', 'Body'],
        );

        $this->getJson('/api/publications/agendada-para-o-futuro')->assertNotFound();
        $slugs = collect($this->getJson('/api/publications')->json('data'))->pluck('slug');
        $this->assertFalse($slugs->contains('agendada-para-o-futuro'));
    }

    public function test_publicacao_agendada_aparece_quando_a_data_chega(): void
    {
        $this->publish(
            'agendada-ja-passou',
            'artigo',
            now()->subMinute()->toIso8601String(),
            ['Chegou', 'Resumo', 'Corpo'],
            ['Arrived', 'Summary', 'Body'],
        );

        $this->getJson('/api/publications/agendada-ja-passou')->assertOk();
    }

    public function test_updated_at_reflete_a_edicao_da_traducao(): void
    {
        $publication = $this->publish(
            'editada-depois-de-publicada',
            'artigo',
            '2026-01-01T00:00:00.000Z',
            ['Original', 'Resumo', 'Corpo'],
            ['Original', 'Summary', 'Body'],
        );

        $antes = $this->getJson('/api/publications/editada-depois-de-publicada?locale=pt')
            ->json('data.updated_at');

        // So a traducao muda — "editar so a traducao tambem regenera" na fase
        // 9 — e e exatamente o caso que a publicacao, sozinha, nao capturaria.
        $this->travel(1)->minute();
        $publication->translations()->where('locale', 'pt')->first()->update(['title' => 'Revisado']);

        $depois = $this->getJson('/api/publications/editada-depois-de-publicada?locale=pt')
            ->json('data.updated_at');

        $this->assertNotSame($antes, $depois);
        $this->assertTrue(Carbon::parse($depois)->greaterThan(Carbon::parse($antes)));
    }

    public function test_a_data_atravessa_o_banco_sem_deslocar(): void
    {
        $this->publish(
            'marco-temporal',
            'artigo',
            '2026-03-01T00:30:00.000Z',
            ['Marco', 'Resumo', 'Corpo'],
            ['Mark', 'Summary', 'Body'],
        );

        $found = collect($this->getJson('/api/publications')->json('data'))
            ->firstWhere('slug', 'marco-temporal');

        // Meia hora depois da virada do mês em UTC. Qualquer deslocamento de
        // fuso a joga para fevereiro — e a estrela muda de lugar na linha do
        // tempo por causa de onde o servidor está.
        $this->assertSame('2026-03-01T00:30:00.000Z', $found['published_at']);
    }

    public function test_a_data_sai_em_iso_8601_zulu(): void
    {
        $published = $this->getJson('/api/publications')->json('data.0.published_at');

        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/', $published);
    }
}
