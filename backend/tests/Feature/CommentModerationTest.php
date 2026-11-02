<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Modules\Community\Actions\SetCommentVisibility;
use App\Modules\Community\Filament\Resources\Comments\Pages\ListComments;
use App\Modules\Community\Models\Comment;
use App\Modules\Content\Models\Publication;
use App\Modules\Identity\Models\Member;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Livewire\Livewire;
use LogicException;
use Tests\TestCase;

class CommentModerationTest extends TestCase
{
    use RefreshDatabase;

    private Publication $publication;

    protected function setUp(): void
    {
        parent::setUp();
        $this->actingAs(User::factory()->create(['email' => config('admin.email')]));

        $this->publication = Publication::create([
            'slug' => 'moderada',
            'category' => 'artigo',
            'published_at' => now()->subDay(),
            'featured' => false,
            'status' => Publication::STATUS_PUBLISHED,
        ]);
        $this->publication->translations()->create(['locale' => 'pt', 'title' => 'T', 'summary' => 'S', 'body' => 'B']);
    }

    private function comment(?Member $member = null, string $status = Comment::STATUS_PUBLISHED): Comment
    {
        return Comment::create([
            'publication_id' => $this->publication->id,
            'member_id' => ($member ?? Member::factory()->create())->id,
            'locale' => 'pt',
            'body' => $status === Comment::STATUS_DELETED ? null : 'Texto',
            'status' => $status,
        ]);
    }

    public function test_a_lista_mostra_autor_e_publicacao(): void
    {
        $comment = $this->comment(Member::factory()->create(['handle' => 'ana']));

        Livewire::test(ListComments::class)
            ->assertCanSeeTableRecords([$comment])
            ->assertTableColumnFormattedStateSet('member_id', '@ana', $comment)
            ->assertTableColumnFormattedStateSet('publication_id', 'moderada', $comment);
    }

    public function test_autores_e_publicacoes_sao_lidos_uma_vez_por_pagina(): void
    {
        foreach (range(1, 6) as $n) {
            $this->comment();
        }

        DB::enableQueryLog();
        Livewire::test(ListComments::class);
        $queries = collect(DB::getQueryLog())->pluck('query');

        $this->assertSame(1, $queries->filter(fn (string $sql): bool => str_contains($sql, 'from "members"'))->count());
        $this->assertSame(1, $queries->filter(fn (string $sql): bool => str_contains($sql, 'from "publications"'))->count());
    }

    public function test_ocultar_tira_da_api_publica_e_mostrar_devolve(): void
    {
        $comment = $this->comment();

        Livewire::test(ListComments::class)->callTableAction('hide', $comment);
        $this->assertSame(Comment::STATUS_HIDDEN, $comment->fresh()?->status);
        $this->getJson('/api/publications/moderada/comments')->assertJsonCount(0, 'data');

        Livewire::test(ListComments::class)->callTableAction('restore', $comment);
        $this->assertSame(Comment::STATUS_PUBLISHED, $comment->fresh()?->status);
        $this->getJson('/api/publications/moderada/comments')->assertJsonCount(1, 'data');
    }

    public function test_apagado_pelo_autor_nao_tem_acao_e_nao_volta(): void
    {
        $comment = $this->comment(status: Comment::STATUS_DELETED);

        Livewire::test(ListComments::class)
            ->assertTableActionHidden('hide', $comment)
            ->assertTableActionHidden('restore', $comment);

        $this->expectException(LogicException::class);
        app(SetCommentVisibility::class)->handle($comment, true);
    }

    public function test_nao_ha_criacao_pelo_painel(): void
    {
        $this->get('/admin/comments/create')->assertNotFound();
        $this->get('/admin/comments')->assertOk();
    }
}
