<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Modules\Content\Models\Media;
use App\Modules\Content\Models\Publication;
use App\Modules\Content\Models\PublicationDraft;
use App\Modules\Content\Models\Tag;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class PublicationAdminApiTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create();
    }

    private function publicationWithDrafts(array $overrides = []): Publication
    {
        $publication = Publication::create(array_merge([
            'slug' => 'publicacao-de-teste',
            'category' => 'artigo',
            'published_at' => now()->subDay(),
            'featured' => false,
            'status' => Publication::STATUS_DRAFT,
        ], $overrides));

        $publication->drafts()->create(['locale' => 'pt', 'blocks' => []]);
        $publication->drafts()->create(['locale' => 'en', 'blocks' => []]);

        return $publication;
    }

    public function test_a_api_exige_autenticacao(): void
    {
        $this->getJson('/admin/api/publications')->assertUnauthorized();
    }

    public function test_lista_publicacoes_de_qualquer_status_com_rascunhos(): void
    {
        $publication = $this->publicationWithDrafts(['status' => Publication::STATUS_DRAFT]);

        $response = $this->actingAs($this->admin())->getJson('/admin/api/publications')->assertOk();

        $response->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $publication->id)
            ->assertJsonPath('data.0.status', Publication::STATUS_DRAFT)
            ->assertJsonPath('data.0.drafts.pt.locale', 'pt')
            ->assertJsonPath('data.0.drafts.en.locale', 'en');
    }

    public function test_show_traz_tags_e_referencias(): void
    {
        $publication = $this->publicationWithDrafts();
        $publication->tags()->attach([
            Tag::create(['locale' => 'pt', 'slug' => 'indices'])->id,
            Tag::create(['locale' => 'en', 'slug' => 'indexes'])->id,
        ]);
        $publication->references()->create(['position' => 0, 'title' => 'Fonte', 'url' => 'https://example.com']);

        $this->actingAs($this->admin())
            ->getJson("/admin/api/publications/{$publication->id}")
            ->assertOk()
            ->assertJsonPath('data.tags', ['pt' => ['indices'], 'en' => ['indexes']])
            ->assertJsonPath('data.references.0.title', 'Fonte');
    }

    public function test_cria_publicacao_com_rascunho_vazio_nos_dois_idiomas(): void
    {
        $response = $this->actingAs($this->admin())->postJson('/admin/api/publications', [
            'slug' => 'nova-publicacao',
            'category' => 'artigo',
            'publishedAt' => now()->toIso8601String(),
        ])->assertCreated();

        $response->assertJsonPath('data.status', Publication::STATUS_DRAFT);

        $publication = Publication::where('slug', 'nova-publicacao')->first();
        $this->assertNotNull($publication);
        $this->assertSame(2, PublicationDraft::where('publication_id', $publication->id)->count());
    }

    public function test_recusa_slug_duplicado(): void
    {
        $this->publicationWithDrafts(['slug' => 'ja-existe']);

        $this->actingAs($this->admin())->postJson('/admin/api/publications', [
            'slug' => 'ja-existe',
            'category' => 'artigo',
            'publishedAt' => now()->toIso8601String(),
        ])->assertUnprocessable()->assertJsonValidationErrors('slug');
    }

    public function test_recusa_slug_com_acento_ou_maiuscula(): void
    {
        $this->actingAs($this->admin())->postJson('/admin/api/publications', [
            'slug' => 'Título Ruim',
            'category' => 'artigo',
            'publishedAt' => now()->toIso8601String(),
        ])->assertUnprocessable()->assertJsonValidationErrors('slug');
    }

    public function test_recusa_categoria_fora_da_lista(): void
    {
        $this->actingAs($this->admin())->postJson('/admin/api/publications', [
            'slug' => 'categoria-ruim',
            'category' => 'inventada',
            'publishedAt' => now()->toIso8601String(),
        ])->assertUnprocessable()->assertJsonValidationErrors('category');
    }

    public function test_autosave_grava_blocos_do_rascunho(): void
    {
        $publication = $this->publicationWithDrafts();

        $this->actingAs($this->admin())->patchJson("/admin/api/publications/{$publication->id}", [
            'drafts' => [
                'pt' => [
                    'title' => 'Título novo',
                    'blocks' => [
                        ['id' => 'b0', 'type' => 'p', 'text' => 'Olá.'],
                    ],
                ],
            ],
        ])->assertOk()->assertJsonPath('data.drafts.pt.title', 'Título novo');

        $draft = PublicationDraft::where('publication_id', $publication->id)->where('locale', 'pt')->first();
        $this->assertSame('Título novo', $draft->title);
        $this->assertCount(1, $draft->blocks);
    }

    public function test_autosave_recusa_bloco_de_tipo_invalido(): void
    {
        $publication = $this->publicationWithDrafts();

        $this->actingAs($this->admin())->patchJson("/admin/api/publications/{$publication->id}", [
            'drafts' => [
                'pt' => ['blocks' => [['id' => 'b0', 'type' => 'tabela', 'text' => 'x']]],
            ],
        ])->assertUnprocessable()->assertJsonValidationErrors('drafts.pt.blocks');
    }

    public function test_autosave_grava_tabela_com_celula_vazia_como_texto(): void
    {
        $publication = $this->publicationWithDrafts();
        $table = [
            'id' => 'b0',
            'type' => 'table',
            'align' => ['left', null],
            'header' => ['Nome', 'Valor'],
            'rows' => [['a', ''], ['b', '2']],
        ];

        $this->actingAs($this->admin())->patchJson("/admin/api/publications/{$publication->id}", [
            'drafts' => ['pt' => ['blocks' => [$table]]],
        ])->assertOk()->assertJsonPath('data.drafts.pt.blocks.0.rows.0.1', '');

        $this->assertEquals([$table], $publication->drafts()->where('locale', 'pt')->first()?->blocks);
    }

    /** @return iterable<string, array{array<string, mixed>}> */
    public static function tabelasInvalidas(): iterable
    {
        $base = ['id' => 'b0', 'type' => 'table', 'align' => [null, null], 'header' => ['a', 'b'], 'rows' => [['1', '2']]];

        yield 'sem colunas' => [['align' => [], 'header' => [], 'rows' => []] + $base];
        yield 'alinhamento desconhecido' => [['align' => ['justify', null]] + $base];
        yield 'linha com célula a menos' => [['rows' => [['1']]] + $base];
        yield 'cabeçalho todo vazio' => [['header' => ['', '']] + $base];
        yield 'célula que não é texto' => [['rows' => [['1', ['x']]]] + $base];
    }

    #[DataProvider('tabelasInvalidas')]
    public function test_autosave_recusa_tabela_invalida(array $table): void
    {
        $publication = $this->publicationWithDrafts();

        $this->actingAs($this->admin())->patchJson("/admin/api/publications/{$publication->id}", [
            'drafts' => ['pt' => ['blocks' => [$table]]],
        ])->assertUnprocessable()->assertJsonValidationErrors('drafts.pt.blocks');
    }

    public function test_autosave_grava_destaque_nota_fluxo_e_codigo_com_arquivo(): void
    {
        $publication = $this->publicationWithDrafts();
        $blocks = [
            ['id' => 'b0', 'type' => 'highlight', 'text' => 'O que importa.'],
            ['id' => 'b1', 'type' => 'note', 'title' => 'Atenção', 'text' => 'Um detalhe.'],
            ['id' => 'b2', 'type' => 'note', 'title' => null, 'text' => 'Sem título.'],
            ['id' => 'b3', 'type' => 'flow', 'steps' => ['Ler', 'Escrever', 'Publicar']],
            ['id' => 'b4', 'type' => 'code', 'lang' => 'ts', 'filename' => 'src/app.ts', 'text' => 'const a = 1;'],
        ];

        $this->actingAs($this->admin())->patchJson("/admin/api/publications/{$publication->id}", [
            'drafts' => ['pt' => ['blocks' => $blocks]],
        ])->assertOk();

        $this->assertEquals($blocks, $publication->drafts()->where('locale', 'pt')->first()?->blocks);
    }

    /** @return iterable<string, array{array<string, mixed>}> */
    public static function blocosNovosInvalidos(): iterable
    {
        yield 'destaque vazio' => [['id' => 'b0', 'type' => 'highlight', 'text' => ' ']];
        yield 'nota sem texto' => [['id' => 'b0', 'type' => 'note', 'title' => 'Só título']];
        yield 'nota com título que não é texto' => [['id' => 'b0', 'type' => 'note', 'title' => ['x'], 'text' => 'a']];
        yield 'fluxo de uma etapa' => [['id' => 'b0', 'type' => 'flow', 'steps' => ['Só']]];
        yield 'fluxo com etapa vazia' => [['id' => 'b0', 'type' => 'flow', 'steps' => ['Ler', '']]];
        yield 'fluxo sem lista' => [['id' => 'b0', 'type' => 'flow', 'steps' => 'Ler, Escrever']];
        yield 'diagrama sem fonte' => [['id' => 'b0', 'type' => 'diagram']];
        yield 'diagrama vazio' => [['id' => 'b0', 'type' => 'diagram', 'source' => '   ']];
        yield 'diagrama longo demais' => [['id' => 'b0', 'type' => 'diagram', 'source' => str_repeat('a', 4001)]];
        yield 'nome de arquivo longo demais' => [['id' => 'b0', 'type' => 'code', 'lang' => null, 'filename' => str_repeat('a', 256), 'text' => 'x']];
    }

    #[DataProvider('blocosNovosInvalidos')]
    public function test_autosave_recusa_bloco_novo_invalido(array $block): void
    {
        $publication = $this->publicationWithDrafts();

        $this->actingAs($this->admin())->patchJson("/admin/api/publications/{$publication->id}", [
            'drafts' => ['pt' => ['blocks' => [$block]]],
        ])->assertUnprocessable()->assertJsonValidationErrors('drafts.pt.blocks');
    }

    public function test_autosave_guarda_diagrama_com_erro_de_sintaxe(): void
    {
        $publication = $this->publicationWithDrafts();
        $blocks = [['id' => 'b0', 'type' => 'diagram', 'source' => "flow f\na -> b"]];

        $this->actingAs($this->admin())->patchJson("/admin/api/publications/{$publication->id}", [
            'drafts' => ['pt' => ['blocks' => $blocks]],
        ])->assertOk();

        $this->assertEquals($blocks, $publication->drafts()->where('locale', 'pt')->first()?->blocks);
    }

    public function test_publicar_serializa_o_diagrama_em_cerca(): void
    {
        $publication = $this->publicationWithDrafts();
        $publication->drafts()->where('locale', 'pt')->update([
            'title' => 'Título',
            'blocks' => [['id' => 'b0', 'type' => 'diagram', 'source' => "flow f\na \"A\""]],
        ]);

        $this->actingAs($this->admin())
            ->postJson("/admin/api/publications/{$publication->id}/publish")
            ->assertOk();

        $this->assertSame(
            "```diagram\nflow f\na \"A\"\n```",
            $publication->translations()->where('locale', 'pt')->first()?->body,
        );
    }

    /** @return iterable<string, array{array<string, mixed>}> */
    public static function diagramasQueNaoPublicam(): iterable
    {
        yield 'sintaxe inválida' => [['id' => 'b0', 'type' => 'diagram', 'source' => "flow f\na -> b"]];
        yield 'código com a linguagem diagram' => [['id' => 'b0', 'type' => 'code', 'lang' => 'diagram', 'text' => 'flow f']];
    }

    #[DataProvider('diagramasQueNaoPublicam')]
    public function test_diagrama_invalido_impede_publicar(array $block): void
    {
        $publication = $this->publicationWithDrafts();
        $publication->drafts()->where('locale', 'pt')->update([
            'title' => 'Título',
            'blocks' => [['id' => 'a0', 'type' => 'p', 'text' => 'Texto.']],
        ]);
        $publication->drafts()->where('locale', 'en')->update(['title' => 'Title', 'blocks' => [$block]]);

        $this->actingAs($this->admin())
            ->postJson("/admin/api/publications/{$publication->id}/publish")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('drafts.en.blocks');

        $this->assertSame(0, $publication->translations()->count());
        $this->assertSame(Publication::STATUS_DRAFT, $publication->refresh()->status);
    }

    public function test_aparencia_grava_limpa_e_recusa_fora_da_faixa(): void
    {
        $publication = $this->publicationWithDrafts();
        $url = "/admin/api/publications/{$publication->id}";

        $this->actingAs($this->admin())->patchJson($url, ['appearance' => ['nebula' => 0.7, 'motion' => false]])
            ->assertOk()
            ->assertJsonPath('data.appearance.nebula', 0.7)
            ->assertJsonPath('data.appearance.motion', false);

        $this->actingAs($this->admin())->patchJson($url, ['featured' => true])
            ->assertJsonPath('data.appearance.nebula', 0.7);

        $this->actingAs($this->admin())->patchJson($url, ['appearance' => null])
            ->assertOk()
            ->assertJsonPath('data.appearance', null);

        $this->actingAs($this->admin())->patchJson($url, ['appearance' => ['nebula' => 2, 'motion' => true]])
            ->assertUnprocessable()->assertJsonValidationErrors('appearance.nebula');
        $this->actingAs($this->admin())->patchJson($url, ['appearance' => ['nebula' => 0.5]])
            ->assertUnprocessable()->assertJsonValidationErrors('appearance.motion');
    }

    public function test_autosave_recusa_imagem_sem_alt(): void
    {
        $publication = $this->publicationWithDrafts();

        $this->actingAs($this->admin())->patchJson("/admin/api/publications/{$publication->id}", [
            'drafts' => [
                'pt' => ['blocks' => [
                    ['id' => 'b0', 'type' => 'img', 'url' => 'https://example.com/a.png', 'alt' => '', 'mediaId' => null, 'caption' => null],
                ]],
            ],
        ])->assertUnprocessable()->assertJsonValidationErrors('drafts.pt.blocks');
    }

    public function test_autosave_recusa_linguagem_de_codigo_com_espaco(): void
    {
        $publication = $this->publicationWithDrafts();

        $this->actingAs($this->admin())->patchJson("/admin/api/publications/{$publication->id}", [
            'drafts' => [
                'pt' => ['blocks' => [
                    ['id' => 'b0', 'type' => 'code', 'lang' => 'c sharp', 'text' => 'x'],
                ]],
            ],
        ])->assertUnprocessable()->assertJsonValidationErrors('drafts.pt.blocks');
    }

    public function test_autosave_sincroniza_tags_e_substitui_referencias(): void
    {
        $publication = $this->publicationWithDrafts();

        $this->actingAs($this->admin())->patchJson("/admin/api/publications/{$publication->id}", [
            'tags' => ['pt' => ['postgres', 'indices'], 'en' => ['postgres', 'indexes']],
            'references' => [
                ['title' => 'Fonte A', 'url' => 'https://example.com/a'],
                ['title' => 'Fonte B', 'url' => '/pt'],
            ],
        ])->assertOk()
            ->assertJsonPath('data.tags.pt', ['postgres', 'indices'])
            ->assertJsonPath('data.tags.en', ['postgres', 'indexes'])
            ->assertJsonPath('data.references.0.title', 'Fonte A')
            ->assertJsonPath('data.references.1.title', 'Fonte B');

        $this->assertSame(4, $publication->tags()->count());
    }

    public function test_autosave_de_um_idioma_nao_mexe_nas_tags_do_outro(): void
    {
        $publication = $this->publicationWithDrafts();
        $admin = $this->admin();

        $this->actingAs($admin)->patchJson("/admin/api/publications/{$publication->id}", [
            'tags' => ['pt' => ['indices', 'postgres'], 'en' => ['indexes']],
        ])->assertOk();

        $this->actingAs($admin)->patchJson("/admin/api/publications/{$publication->id}", [
            'tags' => ['pt' => ['postgres']],
        ])->assertOk()
            ->assertJsonPath('data.tags', ['pt' => ['postgres'], 'en' => ['indexes']]);

        $this->actingAs($admin)->patchJson("/admin/api/publications/{$publication->id}", [
            'tags' => ['en' => []],
        ])->assertOk()
            ->assertJsonPath('data.tags', ['pt' => ['postgres'], 'en' => []]);
    }

    public function test_autosave_recusa_tags_sem_idioma_ou_de_idioma_desconhecido(): void
    {
        $publication = $this->publicationWithDrafts();
        $admin = $this->admin();

        $this->actingAs($admin)->patchJson("/admin/api/publications/{$publication->id}", ['tags' => ['postgres']])
            ->assertUnprocessable()->assertJsonValidationErrors('tags');

        $this->actingAs($admin)->patchJson("/admin/api/publications/{$publication->id}", ['tags' => ['fr' => ['postgres']]])
            ->assertUnprocessable()->assertJsonValidationErrors('tags');

        $this->assertSame(0, $publication->tags()->count());
    }

    public function test_autosave_recusa_url_de_referencia_insegura(): void
    {
        $publication = $this->publicationWithDrafts();

        $this->actingAs($this->admin())->patchJson("/admin/api/publications/{$publication->id}", [
            'references' => [['title' => 'Fonte', 'url' => 'javascript:alert(1)']],
        ])->assertUnprocessable()->assertJsonValidationErrors('references.0.url');

        foreach (['//evil.example/x', '/\\evil.example/x'] as $url) {
            $this->actingAs($this->admin())->patchJson("/admin/api/publications/{$publication->id}", [
                'references' => [['title' => 'Fonte', 'url' => $url]],
            ])->assertUnprocessable()->assertJsonValidationErrors('references.0.url');
        }

        $this->actingAs($this->admin())->patchJson("/admin/api/publications/{$publication->id}", [
            'references' => [['title' => 'Fonte', 'url' => '/pt/publicacoes/outra']],
        ])->assertOk();
    }

    public function test_publicar_bloqueado_sem_titulo_pt(): void
    {
        $publication = $this->publicationWithDrafts();

        $this->actingAs($this->admin())
            ->postJson("/admin/api/publications/{$publication->id}/publish")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('pt');
    }

    public function test_publicar_grava_a_traducao_com_o_markdown_serializado(): void
    {
        $publication = $this->publicationWithDrafts(['published_at' => now()->subDay()]);
        $publication->drafts()->where('locale', 'pt')->update([
            'title' => 'Título PT',
            'subtitle' => 'Subtítulo PT',
            'blocks' => [
                ['id' => 'b0', 'type' => 'h2', 'text' => 'Intro'],
                ['id' => 'b1', 'type' => 'p', 'text' => 'Um **parágrafo**.'],
            ],
        ]);

        $response = $this->actingAs($this->admin())
            ->postJson("/admin/api/publications/{$publication->id}/publish")
            ->assertOk();

        $response->assertJsonPath('data.status', Publication::STATUS_PUBLISHED);

        $translation = $publication->translations()->where('locale', 'pt')->first();
        $this->assertNotNull($translation);
        $this->assertSame('Título PT', $translation->title);
        $this->assertSame('Subtítulo PT', $translation->summary);
        $this->assertSame("## Intro\n\nUm **parágrafo**.", $translation->body);
    }

    public function test_publicar_copia_seo_title_e_seo_description_do_rascunho(): void
    {
        $publication = $this->publicationWithDrafts(['published_at' => now()->subDay()]);
        $publication->drafts()->where('locale', 'pt')->update([
            'title' => 'Título PT',
            'blocks' => [['id' => 'b0', 'type' => 'p', 'text' => 'Texto.']],
            'seo_title' => 'Título de SEO',
            'seo_description' => 'Descrição de SEO.',
        ]);

        $this->actingAs($this->admin())
            ->postJson("/admin/api/publications/{$publication->id}/publish")
            ->assertOk();

        $translation = $publication->translations()->where('locale', 'pt')->first();
        $this->assertSame('Título de SEO', $translation->seo_title);
        $this->assertSame('Descrição de SEO.', $translation->seo_description);
    }

    public function test_publicar_com_data_futura_vira_agendada_nao_publicada(): void
    {
        $publication = $this->publicationWithDrafts(['published_at' => now()->addWeek()]);
        $publication->drafts()->where('locale', 'pt')->update([
            'title' => 'Título PT',
            'blocks' => [['id' => 'b0', 'type' => 'p', 'text' => 'Texto.']],
        ]);

        $this->actingAs($this->admin())
            ->postJson("/admin/api/publications/{$publication->id}/publish")
            ->assertOk()
            ->assertJsonPath('data.status', Publication::STATUS_SCHEDULED);
    }

    public function test_editar_o_rascunho_de_uma_publicada_acusa_alteracoes_pendentes(): void
    {
        $publication = $this->publicationWithDrafts(['published_at' => now()->subDay()]);
        $publication->drafts()->where('locale', 'pt')->update([
            'title' => 'Título PT',
            'blocks' => [['id' => 'b0', 'type' => 'p', 'text' => 'Primeira versão.']],
        ]);

        $this->actingAs($this->admin())
            ->postJson("/admin/api/publications/{$publication->id}/publish")
            ->assertJsonPath('data.pendingChanges', false);

        $this->travel(1)->minutes();
        $this->actingAs($this->admin())
            ->patchJson("/admin/api/publications/{$publication->id}", [
                'drafts' => ['pt' => ['blocks' => [['id' => 'b0', 'type' => 'p', 'text' => 'Segunda versão.']]]],
            ])
            ->assertOk()
            ->assertJsonPath('data.pendingChanges', true);

        $this->assertSame('Primeira versão.', $publication->translations()->where('locale', 'pt')->value('body'));

        $this->travel(1)->minutes();
        $this->actingAs($this->admin())
            ->postJson("/admin/api/publications/{$publication->id}/publish")
            ->assertOk()
            ->assertJsonPath('data.status', Publication::STATUS_PUBLISHED)
            ->assertJsonPath('data.pendingChanges', false);

        $this->assertSame('Segunda versão.', $publication->translations()->where('locale', 'pt')->value('body'));
    }

    public function test_rascunho_nunca_tem_alteracoes_pendentes(): void
    {
        $publication = $this->publicationWithDrafts();

        $this->actingAs($this->admin())
            ->getJson("/admin/api/publications/{$publication->id}")
            ->assertJsonPath('data.pendingChanges', false);
    }

    public function test_despublicar_volta_para_rascunho(): void
    {
        $publication = $this->publicationWithDrafts(['status' => Publication::STATUS_PUBLISHED]);

        $this->actingAs($this->admin())
            ->postJson("/admin/api/publications/{$publication->id}/unpublish")
            ->assertOk()
            ->assertJsonPath('data.status', Publication::STATUS_DRAFT);
    }

    public function test_apaga_publicacao_e_rascunhos(): void
    {
        $publication = $this->publicationWithDrafts();

        $this->actingAs($this->admin())
            ->deleteJson("/admin/api/publications/{$publication->id}")
            ->assertNoContent();

        $this->assertNull(Publication::find($publication->id));
        $this->assertSame(0, PublicationDraft::where('publication_id', $publication->id)->count());
    }

    public function test_upload_redimensiona_e_converte_para_webp(): void
    {
        Storage::fake('media');

        $file = UploadedFile::fake()->image('grande.jpg', 2000, 1000);

        $response = $this->actingAs($this->admin())
            ->postJson('/admin/api/media', ['file' => $file, 'alt' => 'uma descrição'])
            ->assertCreated();

        $response->assertJsonPath('data.mime', 'image/webp')
            ->assertJsonPath('data.width', 1600)
            ->assertJsonPath('data.altDefault', 'uma descrição');

        $this->assertSame(1, Media::count());
        Storage::disk('media')->assertExists(Media::firstOrFail()->path);
    }

    public function test_url_da_midia_e_raiz_relativa(): void
    {
        $this->assertSame('/storage/media/a.webp', Storage::disk('media')->url('media/a.webp'));
    }

    public function test_upload_recusa_imagem_acima_de_16_megapixels(): void
    {
        $file = UploadedFile::fake()->createWithContent('bomba.png', self::pngHeader(20000, 20000));

        $this->actingAs($this->admin())
            ->postJson('/admin/api/media', ['file' => $file])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['file' => '16 megapixels']);

        $this->assertSame(0, Media::count());
    }

    private static function pngHeader(int $width, int $height): string
    {
        $ihdr = 'IHDR'.pack('NNCCCCC', $width, $height, 8, 6, 0, 0, 0);

        return "\x89PNG\r\n\x1a\n".pack('N', 13).$ihdr.pack('N', crc32($ihdr));
    }

    public function test_upload_recusa_arquivo_que_nao_e_imagem(): void
    {
        $file = UploadedFile::fake()->create('arquivo.txt', 10, 'text/plain');

        $this->actingAs($this->admin())
            ->postJson('/admin/api/media', ['file' => $file])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('file');
    }

    public function test_busca_tags_por_prefixo_no_idioma_pedido(): void
    {
        $publication = $this->publicationWithDrafts();
        $publication->tags()->attach([
            Tag::create(['locale' => 'pt', 'slug' => 'postgres'])->id,
            Tag::create(['locale' => 'pt', 'slug' => 'performance'])->id,
            Tag::create(['locale' => 'en', 'slug' => 'performance'])->id,
            Tag::create(['locale' => 'en', 'slug' => 'permissions'])->id,
        ]);
        $admin = $this->admin();

        $this->assertSame(['performance'], $this->actingAs($admin)->getJson('/admin/api/tags?q=per&locale=pt')->assertOk()->json());
        $this->assertSame(['performance', 'permissions'], $this->actingAs($admin)->getJson('/admin/api/tags?q=per&locale=en')->assertOk()->json());
    }

    public function test_busca_de_tags_nao_sugere_quem_ficou_sem_publicacao(): void
    {
        Tag::create(['locale' => 'en', 'slug' => 'performance']);

        $this->assertSame([], $this->actingAs($this->admin())->getJson('/admin/api/tags?q=per&locale=en')->assertOk()->json());
    }

    public function test_busca_de_tags_exige_idioma_valido(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin)->getJson('/admin/api/tags?q=per')->assertUnprocessable();
        $this->actingAs($admin)->getJson('/admin/api/tags?q=per&locale=fr')->assertUnprocessable();
    }

    public function test_a_migracao_copia_as_tags_existentes_para_o_ingles(): void
    {
        $publication = $this->publicationWithDrafts();
        $migration = require database_path('migrations/2026_11_07_000000_add_locale_to_tags_table.php');
        $migration->down();

        $tagId = DB::table('tags')->insertGetId(['slug' => 'indices']);
        DB::table('publication_tag')->insert(['publication_id' => $publication->id, 'tag_id' => $tagId]);

        $migration->up();

        $publication->load('tags');
        $this->assertEqualsCanonicalizing(
            [['pt', 'indices'], ['en', 'indices']],
            $publication->tags->map(fn (Tag $tag): array => [$tag->locale, $tag->slug])->all(),
        );
    }
}
