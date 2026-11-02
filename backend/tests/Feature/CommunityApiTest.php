<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Modules\Community\Models\Comment;
use App\Modules\Content\Models\Publication;
use App\Modules\Identity\Models\Member;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CommunityApiTest extends TestCase
{
    use RefreshDatabase;

    private function publication(string $slug = 'no-ar', string $status = Publication::STATUS_PUBLISHED): Publication
    {
        $publication = Publication::create([
            'slug' => $slug,
            'category' => 'artigo',
            'published_at' => now()->subDay(),
            'featured' => false,
            'status' => $status,
        ]);

        foreach (['pt', 'en'] as $locale) {
            $publication->translations()->create(['locale' => $locale, 'title' => 'T', 'summary' => 'S', 'body' => 'B']);
        }

        return $publication;
    }

    private function comment(Publication $publication, Member $member, string $body, string $locale = 'pt', string $status = Comment::STATUS_PUBLISHED): Comment
    {
        return Comment::create([
            'publication_id' => $publication->id,
            'member_id' => $member->id,
            'locale' => $locale,
            'body' => $body,
            'status' => $status,
        ]);
    }

    public function test_a_lista_publica_mostra_so_os_visiveis_do_idioma_com_o_autor(): void
    {
        $publication = $this->publication();
        $ana = Member::factory()->create(['name' => 'Ana', 'handle' => 'ana', 'avatar_url' => null]);
        $this->comment($publication, $ana, 'Primeiro');
        $this->comment($publication, $ana, 'Oculto', status: Comment::STATUS_HIDDEN);
        $this->comment($publication, $ana, 'Apagado', status: Comment::STATUS_DELETED);
        $this->comment($publication, $ana, 'In English', 'en');

        $this->getJson('/api/publications/no-ar/comments?locale=pt')
            ->assertOk()
            ->assertHeader('Access-Control-Allow-Origin', '*')
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.body', 'Primeiro')
            ->assertJsonPath('data.0.author', ['name' => 'Ana', 'handle' => 'ana', 'avatarUrl' => null])
            ->assertJsonPath('meta.next', null)
            ->assertJsonMissingPath('data.0.memberId');
    }

    public function test_pagina_de_vinte_em_vinte_pelo_after(): void
    {
        $publication = $this->publication();
        $member = Member::factory()->create();
        $comments = collect(range(1, 21))->map(fn (int $n) => $this->comment($publication, $member, "C{$n}"));

        $first = $this->getJson('/api/publications/no-ar/comments')
            ->assertJsonCount(20, 'data')
            ->assertJsonPath('data.0.body', 'C1')
            ->assertJsonPath('meta.next', $comments[19]->id);

        $this->getJson('/api/publications/no-ar/comments?after='.$first->json('meta.next'))
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.body', 'C21')
            ->assertJsonPath('meta.next', null);
    }

    public function test_publicacao_fora_do_ar_ou_inexistente_e_404(): void
    {
        $this->publication('rascunho', Publication::STATUS_DRAFT);

        $this->getJson('/api/publications/rascunho/comments')->assertNotFound();
        $this->getJson('/api/publications/nao-existe/reactions')->assertNotFound();
        $this->getJson('/api/publications/no-ar/comments?locale=fr')->assertUnprocessable();
    }

    public function test_comentar_exige_sessao(): void
    {
        $this->publication();

        $this->postJson('/api/me/comments', ['publication' => 'no-ar', 'locale' => 'pt', 'body' => 'Oi'])
            ->assertUnauthorized();
    }

    public function test_comentar_devolve_201_com_o_autor_e_entra_na_lista(): void
    {
        $this->publication();
        $this->actingAs(Member::factory()->create(['handle' => 'ana']), 'member');

        $this->postJson('/api/me/comments', ['publication' => 'no-ar', 'locale' => 'en', 'body' => "  Hello\r\nworld  "])
            ->assertCreated()
            ->assertJsonPath('data.body', "Hello\nworld")
            ->assertJsonPath('data.author.handle', 'ana');

        $this->getJson('/api/publications/no-ar/comments?locale=en')->assertJsonCount(1, 'data');
    }

    public function test_comentar_valida_texto_idioma_e_publicacao(): void
    {
        $this->publication();
        $this->actingAs(Member::factory()->create(), 'member');
        $max = (int) config('community.comment_max_length');

        $this->postJson('/api/me/comments', ['publication' => 'no-ar', 'locale' => 'pt', 'body' => '   '])
            ->assertJsonValidationErrors('body');
        $this->postJson('/api/me/comments', ['publication' => 'no-ar', 'locale' => 'pt', 'body' => str_repeat('é', $max + 1)])
            ->assertJsonValidationErrors('body');
        $this->postJson('/api/me/comments', ['publication' => 'no-ar', 'locale' => 'fr', 'body' => 'Oi'])
            ->assertJsonValidationErrors('locale');
        $this->postJson('/api/me/comments', ['publication' => 'nao-existe', 'locale' => 'pt', 'body' => 'Oi'])
            ->assertNotFound();
        $this->postJson('/api/me/comments', ['publication' => 'no-ar', 'locale' => 'pt', 'body' => str_repeat('é', $max)])
            ->assertCreated();
    }

    public function test_comentar_demais_em_um_minuto_e_429(): void
    {
        $this->publication();
        $this->actingAs(Member::factory()->create(), 'member');

        foreach (range(1, 5) as $n) {
            $this->postJson('/api/me/comments', ['publication' => 'no-ar', 'locale' => 'pt', 'body' => "Oi {$n}"])->assertCreated();
        }

        $this->postJson('/api/me/comments', ['publication' => 'no-ar', 'locale' => 'pt', 'body' => 'De novo'])
            ->assertTooManyRequests();
    }

    public function test_so_o_autor_apaga_e_apagado_some(): void
    {
        $publication = $this->publication();
        $author = Member::factory()->create();
        $comment = $this->comment($publication, $author, 'Meu');

        $this->actingAs(Member::factory()->create(), 'member')
            ->deleteJson("/api/me/comments/{$comment->id}")
            ->assertForbidden();
        $this->app['auth']->forgetGuards();

        $this->actingAs($author, 'member')->deleteJson("/api/me/comments/{$comment->id}")->assertNoContent();
        $this->actingAs($author, 'member')->deleteJson("/api/me/comments/{$comment->id}")->assertNotFound();
        $this->getJson('/api/publications/no-ar/comments')->assertJsonCount(0, 'data');
    }

    public function test_a_reacao_marca_desmarca_e_conta(): void
    {
        $this->publication();
        $this->actingAs(Member::factory()->create(), 'member');

        $this->getJson('/api/me/reactions/no-ar')->assertJsonPath('data', ['reacted' => false, 'count' => 0]);
        $this->putJson('/api/me/reactions/no-ar')->assertOk()->assertJsonPath('data', ['reacted' => true, 'count' => 1]);
        $this->putJson('/api/me/reactions/no-ar')->assertJsonPath('data.count', 1);
        $this->getJson('/api/me/reactions/no-ar')->assertJsonPath('data.reacted', true);
        $this->getJson('/api/publications/no-ar/reactions')->assertJsonPath('data', ['count' => 1]);
        $this->deleteJson('/api/me/reactions/no-ar')->assertJsonPath('data', ['reacted' => false, 'count' => 0]);
    }

    public function test_reagir_exige_sessao(): void
    {
        $this->publication();

        $this->putJson('/api/me/reactions/no-ar')->assertUnauthorized();
        $this->getJson('/api/me/reactions/no-ar')->assertUnauthorized();
    }
}
