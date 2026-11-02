<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Modules\Activity\Models\Activity;
use App\Modules\Community\Actions\DeleteComment;
use App\Modules\Community\Actions\PostComment;
use App\Modules\Community\Actions\SetReaction;
use App\Modules\Community\Models\Comment;
use App\Modules\Community\Models\Reaction;
use App\Modules\Content\Contracts\PublicationSlugs;
use App\Modules\Content\Models\Publication;
use App\Modules\Identity\Actions\DeleteMember;
use App\Modules\Identity\Contracts\PublicProfiles;
use App\Modules\Identity\Models\Member;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CommunityDomainTest extends TestCase
{
    use RefreshDatabase;

    private function publication(string $slug = 'no-ar'): Publication
    {
        return Publication::create([
            'slug' => $slug,
            'category' => 'artigo',
            'published_at' => now()->subDay(),
            'featured' => false,
            'status' => Publication::STATUS_PUBLISHED,
        ]);
    }

    /** @return list<string> */
    private function verbs(int $memberId): array
    {
        return Activity::query()->where('member_id', $memberId)->orderBy('id')->pluck('verb')->all();
    }

    public function test_comentar_grava_o_texto_normalizado_e_registra_a_atividade(): void
    {
        $member = Member::factory()->create();
        $publication = $this->publication();

        $comment = app(PostComment::class)->handle($member->id, $publication->id, 'pt', "  Linha um\r\nLinha dois  ");

        $this->assertSame("Linha um\nLinha dois", $comment->body);
        $this->assertSame(Comment::STATUS_PUBLISHED, $comment->status);
        $this->assertSame(['comment.posted'], $this->verbs($member->id));
    }

    public function test_so_o_autor_apaga_e_o_texto_some(): void
    {
        $author = Member::factory()->create();
        $other = Member::factory()->create();
        $comment = app(PostComment::class)->handle($author->id, $this->publication()->id, 'pt', 'Oi');

        $this->assertThrows(fn () => app(DeleteComment::class)->handle($comment, $other->id), AuthorizationException::class);
        $this->assertSame('Oi', $comment->fresh()?->body);

        app(DeleteComment::class)->handle($comment, $author->id);

        $this->assertNull($comment->fresh()?->body);
        $this->assertSame(Comment::STATUS_DELETED, $comment->fresh()?->status);
        $this->assertSame(['comment.posted', 'comment.deleted'], $this->verbs($author->id));
    }

    public function test_a_reacao_e_uma_por_pessoa_e_desfazer_e_idempotente(): void
    {
        $member = Member::factory()->create();
        $publication = $this->publication();
        $react = app(SetReaction::class);

        $react->handle($member->id, $publication->id, true);
        $react->handle($member->id, $publication->id, true);
        $this->assertSame(1, Reaction::query()->count());

        $react->handle($member->id, $publication->id, false);
        $react->handle($member->id, $publication->id, false);
        $this->assertSame(0, Reaction::query()->count());

        $this->assertSame(['reaction.added', 'reaction.removed'], $this->verbs($member->id));
    }

    public function test_apagar_a_conta_apaga_as_reacoes_e_o_texto_dos_comentarios(): void
    {
        $member = Member::factory()->create();
        $publication = $this->publication();
        $comment = app(PostComment::class)->handle($member->id, $publication->id, 'pt', 'Meu texto');
        app(SetReaction::class)->handle($member->id, $publication->id, true);

        app(DeleteMember::class)->handle($member);

        $this->assertSame(0, Reaction::query()->count());
        $this->assertNull($comment->fresh()?->body);
        $this->assertSame(Comment::STATUS_DELETED, $comment->fresh()?->status);
    }

    public function test_o_export_traz_comentarios_e_reacoes_com_o_slug(): void
    {
        $member = Member::factory()->create();
        $publication = $this->publication('com-slug');
        app(PostComment::class)->handle($member->id, $publication->id, 'en', 'Hello');
        app(SetReaction::class)->handle($member->id, $publication->id, true);

        $this->actingAs($member, 'member')
            ->getJson('/api/me/export')
            ->assertOk()
            ->assertJsonPath('community.comments.0.publication', 'com-slug')
            ->assertJsonPath('community.comments.0.body', 'Hello')
            ->assertJsonPath('community.comments.0.locale', 'en')
            ->assertJsonPath('community.reactions.0.publication', 'com-slug');
    }

    public function test_os_contratos_de_leitura_devolvem_por_id(): void
    {
        $member = Member::factory()->create(['name' => 'Ana', 'handle' => 'ana', 'avatar_url' => null]);
        $publication = $this->publication('contrato');

        $profiles = app(PublicProfiles::class)->forMembers([$member->id, $member->id, 999]);
        $this->assertSame(['name' => 'Ana', 'handle' => 'ana', 'avatarUrl' => null], $profiles[$member->id]->toArray());
        $this->assertArrayNotHasKey(999, $profiles);

        $this->assertSame([$publication->id => 'contrato'], app(PublicationSlugs::class)->forIds([$publication->id]));
        $this->assertSame([], app(PublicProfiles::class)->forMembers([]));
    }
}
