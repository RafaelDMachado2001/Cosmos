<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Modules\Community\Filament\Resources\Comments\Pages\ListComments;
use App\Modules\Community\Models\Comment;
use App\Modules\Community\Models\Reaction;
use App\Modules\Content\Contracts\PublicationEngagement;
use App\Modules\Content\Filament\Resources\Publications\Pages\ListPublications;
use App\Modules\Content\Models\Publication;
use App\Modules\Identity\Models\Member;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Livewire\Livewire;
use Tests\TestCase;

class PublicationEngagementTest extends TestCase
{
    use RefreshDatabase;

    private function publication(string $slug): Publication
    {
        $publication = Publication::create([
            'slug' => $slug,
            'category' => 'artigo',
            'published_at' => now()->subDay(),
            'featured' => false,
            'status' => Publication::STATUS_PUBLISHED,
        ]);
        $publication->translations()->create(['locale' => 'pt', 'title' => $slug, 'summary' => 'S', 'body' => 'B']);
        $publication->drafts()->create(['locale' => 'pt', 'blocks' => []]);
        $publication->drafts()->create(['locale' => 'en', 'blocks' => []]);

        return $publication;
    }

    private function comment(Publication $publication, string $status = Comment::STATUS_PUBLISHED): void
    {
        Comment::create([
            'publication_id' => $publication->id,
            'member_id' => Member::factory()->create()->id,
            'locale' => 'pt',
            'body' => $status === Comment::STATUS_DELETED ? null : 'Texto',
            'status' => $status,
        ]);
    }

    private function react(Publication $publication, int $times): void
    {
        foreach (range(1, $times) as $n) {
            Reaction::create(['publication_id' => $publication->id, 'member_id' => Member::factory()->create()->id]);
        }
    }

    public function test_conta_so_comentarios_visiveis_e_todas_as_reacoes(): void
    {
        $cafe = $this->publication('cafe');
        $vazia = $this->publication('vazia');
        $this->comment($cafe);
        $this->comment($cafe);
        $this->comment($cafe, Comment::STATUS_HIDDEN);
        $this->comment($cafe, Comment::STATUS_DELETED);
        $this->react($cafe, 3);

        $engagement = app(PublicationEngagement::class)->forPublications([$cafe->id, $vazia->id]);

        $this->assertSame(2, $engagement[$cafe->id]->comments);
        $this->assertSame(3, $engagement[$cafe->id]->reactions);
        $this->assertSame(0, $engagement[$vazia->id]->comments);
        $this->assertStringContainsString('/admin/comments?', (string) $engagement[$cafe->id]->moderationUrl);
        $this->assertSame([], app(PublicationEngagement::class)->forPublications([]));
    }

    public function test_a_api_do_painel_traz_os_numeros_com_duas_consultas_para_a_lista_toda(): void
    {
        $publications = collect(['a', 'b', 'c', 'd'])->map(fn (string $slug) => $this->publication($slug));
        $this->comment($publications[0]);
        $this->react($publications[1], 2);

        DB::enableQueryLog();
        $response = $this->actingAs(User::factory()->create())->getJson('/admin/api/publications')->assertOk();
        $queries = collect(DB::getQueryLog())->pluck('query');

        $this->assertSame(1, $queries->filter(fn (string $sql): bool => str_contains($sql, 'from "comments"'))->count());
        $this->assertSame(1, $queries->filter(fn (string $sql): bool => str_contains($sql, 'from "reactions"'))->count());

        $bySlug = collect($response->json('data'))->keyBy('slug');
        $this->assertSame(1, $bySlug['a']['engagement']['comments']);
        $this->assertSame(2, $bySlug['b']['engagement']['reactions']);
        $this->assertSame(0, $bySlug['d']['engagement']['comments']);
    }

    public function test_o_detalhe_do_painel_tambem_traz_os_numeros(): void
    {
        $cafe = $this->publication('cafe');
        $this->comment($cafe);

        $this->actingAs(User::factory()->create())
            ->getJson("/admin/api/publications/{$cafe->id}")
            ->assertOk()
            ->assertJsonPath('data.engagement.comments', 1)
            ->assertJsonPath('data.engagement.reactions', 0);
    }

    public function test_a_lista_do_filament_mostra_os_numeros(): void
    {
        $this->actingAs(User::factory()->create(['email' => config('admin.email')]));
        $cafe = $this->publication('cafe');
        $this->comment($cafe);
        $this->react($cafe, 4);

        Livewire::test(ListPublications::class)
            ->assertTableColumnStateSet('engagement_comments', 1, $cafe)
            ->assertTableColumnStateSet('engagement_reactions', 4, $cafe);
    }

    public function test_a_moderacao_filtra_por_publicacao(): void
    {
        $this->actingAs(User::factory()->create(['email' => config('admin.email')]));
        $cafe = $this->publication('cafe');
        $outra = $this->publication('outra');
        $this->comment($cafe);
        $this->comment($outra);
        $doCafe = Comment::query()->where('publication_id', $cafe->id)->get();
        $daOutra = Comment::query()->where('publication_id', $outra->id)->get();

        Livewire::test(ListComments::class)
            ->filterTable('publication_id', (string) $cafe->id)
            ->assertCanSeeTableRecords($doCafe)
            ->assertCanNotSeeTableRecords($daOutra);
    }
}
