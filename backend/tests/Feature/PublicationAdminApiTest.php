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
use Illuminate\Support\Facades\Storage;
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

    // -- autenticação -------------------------------------------------------

    public function test_a_api_exige_autenticacao(): void
    {
        $this->getJson('/admin/api/publications')->assertUnauthorized();
    }

    // -- index / show ---------------------------------------------------------

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
        $tag = Tag::create(['slug' => 'postgres']);
        $publication->tags()->attach($tag);
        $publication->references()->create(['position' => 0, 'title' => 'Fonte', 'url' => 'https://example.com']);

        $this->actingAs($this->admin())
            ->getJson("/admin/api/publications/{$publication->id}")
            ->assertOk()
            ->assertJsonPath('data.tags.0', 'postgres')
            ->assertJsonPath('data.references.0.title', 'Fonte');
    }

    // -- store ----------------------------------------------------------------

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

    // -- update (autosave) -----------------------------------------------------

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
            'tags' => ['postgres', 'indices'],
            'references' => [
                ['title' => 'Fonte A', 'url' => 'https://example.com/a'],
                ['title' => 'Fonte B', 'url' => '/pt'],
            ],
        ])->assertOk()
            ->assertJsonPath('data.tags', ['postgres', 'indices'])
            ->assertJsonPath('data.references.0.title', 'Fonte A')
            ->assertJsonPath('data.references.1.title', 'Fonte B');

        $this->assertSame(2, $publication->tags()->count());
    }

    public function test_autosave_recusa_url_de_referencia_insegura(): void
    {
        $publication = $this->publicationWithDrafts();

        $this->actingAs($this->admin())->patchJson("/admin/api/publications/{$publication->id}", [
            'references' => [['title' => 'Fonte', 'url' => 'javascript:alert(1)']],
        ])->assertUnprocessable()->assertJsonValidationErrors('references.0.url');

        // Parecem raiz-relativos, mas o navegador os lê como outro host.
        foreach (['//evil.example/x', '/\\evil.example/x'] as $url) {
            $this->actingAs($this->admin())->patchJson("/admin/api/publications/{$publication->id}", [
                'references' => [['title' => 'Fonte', 'url' => $url]],
            ])->assertUnprocessable()->assertJsonValidationErrors('references.0.url');
        }

        $this->actingAs($this->admin())->patchJson("/admin/api/publications/{$publication->id}", [
            'references' => [['title' => 'Fonte', 'url' => '/pt/publicacoes/outra']],
        ])->assertOk();
    }

    // -- publish / unpublish ----------------------------------------------------

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

        // A tradução no ar continua a anterior até atualizar.
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

    // -- destroy ----------------------------------------------------------------

    public function test_apaga_publicacao_e_rascunhos(): void
    {
        $publication = $this->publicationWithDrafts();

        $this->actingAs($this->admin())
            ->deleteJson("/admin/api/publications/{$publication->id}")
            ->assertNoContent();

        $this->assertNull(Publication::find($publication->id));
        $this->assertSame(0, PublicationDraft::where('publication_id', $publication->id)->count());
    }

    // -- mídia ----------------------------------------------------------------

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
        // Sem Storage::fake, que ignora o 'url' do disco. Com o APP_URL, a
        // imagem publicada apontava para o host do backend, não o do site — o
        // Nginx serve /storage/ no mesmo host das páginas.
        $this->assertSame('/storage/media/a.webp', Storage::disk('media')->url('media/a.webp'));
    }

    public function test_upload_recusa_imagem_acima_de_16_megapixels(): void
    {
        // Uma bomba de descompressão: poucos bytes, e o cabeçalho declara
        // 20000 × 20000. Decodificada, ocuparia 1,6 GB; nem o próprio
        // UploadedFile::fake()->image() desenharia isso nos 128 MB do PHP.
        $file = UploadedFile::fake()->createWithContent('bomba.png', self::pngHeader(20000, 20000));

        $this->actingAs($this->admin())
            ->postJson('/admin/api/media', ['file' => $file])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['file' => '16 megapixels']);

        $this->assertSame(0, Media::count());
    }

    /** Assinatura e IHDR de um PNG: o que o getimagesize lê para dar o tamanho. */
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

    // -- tags -----------------------------------------------------------------

    public function test_busca_tags_por_prefixo(): void
    {
        Tag::create(['slug' => 'postgres']);
        Tag::create(['slug' => 'performance']);
        Tag::create(['slug' => 'react']);

        $response = $this->actingAs($this->admin())
            ->getJson('/admin/api/tags?q=per')
            ->assertOk();

        $this->assertSame(['performance'], $response->json());
    }
}
