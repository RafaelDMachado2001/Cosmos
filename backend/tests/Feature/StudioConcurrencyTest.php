<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\StudioToken;
use App\Models\User;
use App\Modules\Content\Filament\Resources\Publications\Pages\EditPublication;
use App\Modules\Content\Models\Publication;
use App\Modules\Content\Models\PublicationDraft;
use App\Modules\Content\Support\ScheduledPublisher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;
use Livewire\Livewire;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Tests\TestCase;

class StudioConcurrencyTest extends TestCase
{
    use RefreshDatabase;

    private Publication $publication;

    private string $url;

    protected function setUp(): void
    {
        parent::setUp();

        $admin = User::factory()->create(['email' => config('admin.email')]);
        [, $token] = StudioToken::issue($admin, 'teste', 30);
        $this->withToken($token);

        $this->publication = Publication::create([
            'slug' => 'concorrencia',
            'category' => 'artigo',
            'published_at' => now()->subDay(),
            'featured' => false,
            'status' => Publication::STATUS_DRAFT,
        ]);
        foreach (['pt', 'en'] as $locale) {
            $this->publication->drafts()->create([
                'locale' => $locale,
                'title' => 'Original',
                'blocks' => [['id' => 'b0', 'type' => 'p', 'text' => 'Texto.']],
            ]);
        }
        $this->url = "/api/studio/publications/{$this->publication->id}";
    }

    private function etag(): string
    {
        return (string) $this->getJson($this->url)->assertOk()->headers->get('ETag');
    }

    private function patchTitle(string $title, string $etag): TestResponse
    {
        return $this->patchJson($this->url, ['drafts' => ['pt' => ['title' => $title]]], ['If-Match' => $etag]);
    }

    private function title(): ?string
    {
        return $this->publication->drafts()->where('locale', 'pt')->firstOrFail()->title;
    }

    public function test_detalhe_traz_etag_forte_e_estavel_no_cabecalho_e_no_corpo(): void
    {
        $response = $this->getJson($this->url)->assertOk();
        $etag = (string) $response->headers->get('ETag');

        $this->assertMatchesRegularExpression('/^"[0-9a-f]{64}"$/', $etag);
        $this->assertSame($etag, $response->json('data.etag'));
        $this->assertSame($etag, $this->etag());
        $this->getJson('/api/studio/publications')->assertJsonPath('data.0.etag', $etag);
    }

    public function test_patch_sem_if_match_responde_428_e_nao_grava(): void
    {
        $this->patchJson($this->url, ['slug' => 'outro'])->assertStatus(428);
        $this->patchJson($this->url, ['slug' => 'outro'], ['If-Match' => '*'])->assertStatus(428);

        $this->assertSame('concorrencia', $this->publication->refresh()->slug);
    }

    public function test_patch_com_versao_obsoleta_responde_412_e_preserva_a_outra_escrita(): void
    {
        $etag = $this->etag();

        $this->patchTitle('Primeira', $etag)->assertOk();
        $this->patchTitle('Segunda', $etag)->assertStatus(412);

        $this->assertSame('Primeira', $this->title());
    }

    public function test_patch_devolve_a_nova_etag_que_vale_para_o_proximo(): void
    {
        $before = $this->etag();
        $response = $this->patchTitle('Primeira', $before)->assertOk();
        $after = (string) $response->headers->get('ETag');

        $this->assertNotSame($before, $after);
        $this->assertSame($after, $response->json('data.etag'));
        $this->assertSame($after, $this->etag());
        $this->patchTitle('Segunda', $after)->assertOk();
    }

    public function test_comparacao_e_forte_e_aceita_lista(): void
    {
        $etag = $this->etag();

        $this->patchTitle('Fraca', "W/{$etag}")->assertStatus(412);
        $this->patchTitle('Sem aspas', trim($etag, '"'))->assertStatus(412);
        $this->patchTitle('Lista', "\"velha\", {$etag}")->assertOk();
    }

    /** @return iterable<string, array{array<string, mixed>}> */
    public static function edicoes(): iterable
    {
        yield 'slug' => [['slug' => 'novo-slug']];
        yield 'categoria' => [['category' => 'estudo']];
        yield 'data com milissegundos' => [['publishedAt' => '2026-01-02T03:04:05.678Z']];
        yield 'destaque' => [['featured' => true]];
        yield 'indexável' => [['indexable' => false]];
        yield 'aparência' => [['appearance' => ['nebula' => 1, 'motion' => false]]];
        yield 'tags' => [['tags' => ['en' => ['indexes']]]];
        yield 'referências' => [['references' => [['title' => 'A', 'url' => '/pt']]]];
        yield 'rascunho inglês' => [['drafts' => ['en' => ['subtitle' => 'New']]]];
        yield 'blocos' => [['drafts' => ['pt' => ['blocks' => [['id' => 'b1', 'type' => 'p', 'text' => 'Outro.']]]]]];
        yield 'seo' => [['drafts' => ['pt' => ['seoTitle' => 'SEO']]]];
    }

    #[DataProvider('edicoes')]
    public function test_toda_edicao_muda_a_versao(array $patch): void
    {
        $before = $this->etag();
        $after = $this->patchJson($this->url, $patch, ['If-Match' => $before])->assertOk()->headers->get('ETag');

        $this->assertNotSame($before, $after);
        $this->assertSame($after, $this->etag());
    }

    public function test_verifica_o_estado_de_dentro_da_transacao_e_nao_o_do_route_binding(): void
    {
        $etag = $this->etag();
        $raced = false;
        Publication::retrieved(function (Publication $publication) use (&$raced): void {
            if ($raced) {
                return;
            }
            $raced = true;
            DB::table('publication_drafts')
                ->where('publication_id', $publication->id)
                ->where('locale', 'pt')
                ->update(['title' => 'Concorrente']);
        });

        $this->patchTitle('Minha', $etag)->assertStatus(412);

        $this->assertTrue($raced);
        $this->assertSame('Concorrente', $this->title());
    }

    public function test_os_gravadores_travam_a_linha_da_publicacao(): void
    {
        $this->assertLocks(fn () => $this->patchTitle('Nova', $this->etag())->assertOk());
        $this->assertLocks(fn () => $this->postJson("{$this->url}/publish")->assertOk());
        $this->assertLocks(fn () => $this->postJson("{$this->url}/unpublish")->assertOk());
        $this->assertLocks(fn () => $this->artisan('rdm-studio:seed-drafts')->assertSuccessful()->run());

        $this->publication->update(['status' => Publication::STATUS_SCHEDULED]);
        $this->assertLocks(fn () => ScheduledPublisher::run());
        $this->assertSame(Publication::STATUS_PUBLISHED, $this->publication->refresh()->status);
    }

    private function assertLocks(callable $write): void
    {
        DB::flushQueryLog();
        DB::enableQueryLog();
        $write();
        $queries = array_column(DB::getQueryLog(), 'query');
        DB::disableQueryLog();

        $this->assertNotEmpty(array_filter(
            $queries,
            fn (string $sql): bool => str_contains($sql, 'from "publications"') && str_ends_with($sql, 'for update'),
        ));
    }

    public function test_falha_no_meio_desfaz_o_patch_inteiro(): void
    {
        $etag = $this->etag();
        PublicationDraft::saving(fn () => throw new RuntimeException('falha simulada'));

        $this->patchJson($this->url, [
            'slug' => 'pela-metade',
            'tags' => ['pt' => ['indices']],
            'references' => [['title' => 'A', 'url' => '/pt']],
            'drafts' => ['pt' => ['title' => 'Pela metade']],
        ], ['If-Match' => $etag])->assertServerError();

        $this->assertSame('concorrencia', $this->publication->refresh()->slug);
        $this->assertSame(0, $this->publication->tags()->count());
        $this->assertSame(0, $this->publication->references()->count());
        $this->assertSame($etag, $this->etag());
    }

    public function test_publicar_e_despublicar_devolvem_nova_etag(): void
    {
        $draft = $this->etag();
        $published = (string) $this->postJson("{$this->url}/publish")->assertOk()->headers->get('ETag');
        $this->assertNotSame($draft, $published);
        $this->assertSame($published, $this->etag());
        $this->patchTitle('Obsoleta', $draft)->assertStatus(412);

        $unpublished = (string) $this->postJson("{$this->url}/unpublish")->assertOk()->headers->get('ETag');
        $this->assertNotSame($published, $unpublished);
        $this->patchTitle('Atual', $unpublished)->assertOk();
    }

    public function test_formulario_do_painel_nao_sobrescreve_o_que_mudou_depois_de_aberto(): void
    {
        $this->actingAs(User::query()->firstOrFail());
        $this->publication->translations()->create(['locale' => 'pt', 'title' => 'T', 'summary' => 'R', 'body' => 'C']);

        $form = Livewire::test(EditPublication::class, ['record' => $this->publication->getRouteKey()])
            ->fillForm(['slug' => 'do-painel']);
        Publication::findOrFail($this->publication->id)->update(['slug' => 'do-studio']);
        $form->call('save')->assertNotified();
        $this->assertSame('do-studio', $this->publication->refresh()->slug);

        Livewire::test(EditPublication::class, ['record' => $this->publication->getRouteKey()])
            ->fillForm(['slug' => 'do-painel'])
            ->call('save')
            ->assertHasNoFormErrors();
        $this->assertSame('do-painel', $this->publication->refresh()->slug);
    }
}
