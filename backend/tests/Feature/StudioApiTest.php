<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\StudioToken;
use App\Models\User;
use App\Modules\Content\Models\Publication;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StudioApiTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['email' => config('admin.email')]);
    }

    private function token(?User $user = null, int $days = 30): string
    {
        [, $plain] = StudioToken::issue($user ?? $this->admin(), 'teste', $days);

        return $plain;
    }

    private function publication(): Publication
    {
        $publication = Publication::create([
            'slug' => 'publicacao-da-api',
            'category' => 'artigo',
            'published_at' => now()->subDay(),
            'featured' => false,
            'status' => Publication::STATUS_DRAFT,
        ]);
        $publication->drafts()->create(['locale' => 'pt', 'blocks' => []]);
        $publication->drafts()->create(['locale' => 'en', 'blocks' => []]);

        return $publication;
    }

    public function test_sem_token_responde_401_com_desafio_bearer(): void
    {
        $this->getJson('/api/studio/publications')
            ->assertUnauthorized()
            ->assertHeader('WWW-Authenticate', 'Bearer realm="rdm-studio"');
    }

    public function test_token_invalido_expirado_ou_de_outro_usuario_nao_entra(): void
    {
        $admin = $this->admin();
        $expired = $this->token($admin, 1);
        $other = $this->token(User::factory()->create());

        $this->withToken('rdms_naoexiste')->getJson('/api/studio/publications')->assertUnauthorized();
        $this->withToken(substr($this->token($admin), 5))->getJson('/api/studio/publications')->assertUnauthorized();
        $this->withToken($other)->getJson('/api/studio/publications')->assertUnauthorized();

        $this->travelTo(CarbonImmutable::now()->addDays(2));
        $this->withToken($expired)->getJson('/api/studio/publications')->assertUnauthorized();
    }

    public function test_a_sessao_do_painel_nao_abre_a_api_do_studio(): void
    {
        $this->actingAs($this->admin())->getJson('/api/studio/publications')->assertUnauthorized();
    }

    public function test_o_banco_guarda_so_o_hash(): void
    {
        $plain = $this->token();

        $this->assertStringStartsWith(StudioToken::PREFIX, $plain);
        $this->assertDatabaseMissing('studio_tokens', ['token_hash' => $plain]);
        $this->assertDatabaseHas('studio_tokens', ['token_hash' => hash('sha256', $plain)]);
    }

    public function test_com_token_lista_le_e_marca_o_uso(): void
    {
        $publication = $this->publication();
        $token = $this->token();

        $this->withToken($token)->getJson('/api/studio/me')
            ->assertOk()
            ->assertJsonPath('data.user', config('admin.email'))
            ->assertJsonPath('data.token.name', 'teste');

        $this->withToken($token)->getJson('/api/studio/publications')
            ->assertOk()
            ->assertJsonPath('data.0.slug', 'publicacao-da-api');

        $this->withToken($token)->getJson("/api/studio/publications/{$publication->id}")
            ->assertOk()
            ->assertJsonPath('data.drafts.pt.locale', 'pt');

        $this->assertNotNull(StudioToken::query()->sole()->last_used_at);
    }

    public function test_cria_edita_o_rascunho_e_publica_sem_csrf(): void
    {
        $token = $this->token();

        $id = $this->withToken($token)->postJson('/api/studio/publications', [
            'slug' => 'nova-pela-api',
            'category' => 'estudo',
            'publishedAt' => now()->subHour()->toIso8601String(),
        ])->assertSuccessful()->json('data.id');

        $this->withToken($token)->patchJson("/api/studio/publications/{$id}", [
            'drafts' => ['pt' => [
                'title' => 'Nova pela API',
                'subtitle' => 'Resumo',
                'blocks' => [['id' => 'b1', 'type' => 'p', 'text' => 'Olá **mundo**.']],
            ]],
        ])->assertOk()->assertJsonPath('data.drafts.pt.title', 'Nova pela API');

        $this->withToken($token)->postJson("/api/studio/publications/{$id}/publish")
            ->assertOk()
            ->assertJsonPath('data.status', Publication::STATUS_PUBLISHED);

        $this->assertDatabaseHas('publication_translations', [
            'publication_id' => $id,
            'locale' => 'pt',
            'title' => 'Nova pela API',
            'body' => 'Olá **mundo**.',
        ]);
    }

    public function test_apagar_nao_existe_na_api_do_studio(): void
    {
        $publication = $this->publication();

        $this->withToken($this->token())->deleteJson("/api/studio/publications/{$publication->id}")
            ->assertMethodNotAllowed();

        $this->assertModelExists($publication);
    }

    public function test_previa_mostra_o_markdown_do_rascunho_e_o_publicado(): void
    {
        $publication = $this->publication();
        $publication->drafts()->where('locale', 'pt')->update([
            'title' => 'Prévia',
            'blocks' => json_encode([
                ['id' => 'b1', 'type' => 'h2', 'text' => 'Seção'],
                ['id' => 'b2', 'type' => 'diagram', 'source' => 'flow quebrado'],
            ]),
        ]);

        $response = $this->withToken($this->token())
            ->getJson("/api/studio/publications/{$publication->id}/preview")
            ->assertOk()
            ->assertJsonPath('data.locales.pt.draft.title', 'Prévia')
            ->assertJsonPath('data.locales.pt.published', null)
            ->assertJsonPath('data.locales.en.draft.markdown', '');

        $this->assertStringStartsWith('## Seção', $response->json('data.locales.pt.draft.markdown'));
        $this->assertNotEmpty($response->json('data.locales.pt.draft.diagramErrors'));
    }

    public function test_converte_markdown_em_blocos_e_de_volta(): void
    {
        $token = $this->token();
        $markdown = "## Título\n\nTexto com `código`.\n\n> [!note] Nota\n> Corpo da nota.";

        $blocks = $this->withToken($token)
            ->postJson('/api/studio/convert/markdown-to-blocks', ['markdown' => $markdown])
            ->assertOk()
            ->json('data');

        $this->assertSame(['h2', 'p', 'note'], array_column($blocks, 'type'));

        $this->withToken($token)
            ->postJson('/api/studio/convert/blocks-to-markdown', ['blocks' => $blocks])
            ->assertOk()
            ->assertJsonPath('data.markdown', $markdown)
            ->assertJsonPath('data.diagramErrors', []);
    }

    public function test_blocos_invalidos_sao_recusados_na_conversao(): void
    {
        $this->withToken($this->token())
            ->postJson('/api/studio/convert/blocks-to-markdown', ['blocks' => [['type' => 'nada']]])
            ->assertUnprocessable();
    }

    public function test_a_api_do_studio_mora_no_host_da_api(): void
    {
        config(['hosts.admin' => 'admin.rdmlabs.test', 'hosts.api' => 'api.rdmlabs.test']);
        $token = $this->token();

        $this->withToken($token)->getJson('http://api.rdmlabs.test/api/studio/me')->assertOk();
        $this->withToken($token)->getJson('http://admin.rdmlabs.test/api/studio/me')->assertNotFound();
    }

    public function test_o_painel_gera_mostra_uma_vez_e_revoga(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin)
            ->post('/admin/studio/tokens', ['name' => 'claude', 'days' => 30])
            ->assertRedirect('/admin/studio/tokens');

        $page = $this->actingAs($admin)->get('/admin/studio/tokens')->assertOk();
        preg_match('/rdms_[A-Za-z0-9]{48}/', (string) $page->getContent(), $match);
        $this->assertCount(1, $match);

        $this->withToken($match[0])->getJson('/api/studio/me')->assertOk();

        $this->actingAs($admin)->get('/admin/studio/tokens')->assertOk()->assertDontSee($match[0]);

        $id = StudioToken::query()->sole()->id;
        $this->actingAs($admin)->delete("/admin/studio/tokens/{$id}")->assertRedirect('/admin/studio/tokens');
        $this->assertDatabaseCount('studio_tokens', 0);
    }

    public function test_o_painel_mostra_o_endereco_da_api_no_host_dela(): void
    {
        config(['hosts.admin' => 'admin.rdmlabs.test', 'hosts.api' => 'api.rdmlabs.test']);

        $this->actingAs($this->admin())
            ->get('http://admin.rdmlabs.test/admin/studio/tokens')
            ->assertOk()
            ->assertSee('https://api.rdmlabs.test/api/studio');
    }

    public function test_so_o_admin_gera_token_pelo_painel(): void
    {
        $this->actingAs(User::factory()->create())
            ->post('/admin/studio/tokens', ['name' => 'x', 'days' => 30])
            ->assertForbidden();

        $this->assertDatabaseCount('studio_tokens', 0);
    }

    public function test_visitante_vai_para_o_login(): void
    {
        $this->get('/admin/studio/tokens')->assertRedirect(route('login'));
        $this->post('/admin/studio/tokens', ['name' => 'x', 'days' => 30])->assertRedirect(route('login'));
        $this->assertDatabaseCount('studio_tokens', 0);
    }

    public function test_comando_cria_lista_e_revoga(): void
    {
        $this->admin();

        $this->artisan('studio:token', ['--name' => 'local', '--days' => 7])
            ->expectsOutputToContain(StudioToken::PREFIX)
            ->assertSuccessful();

        $token = StudioToken::query()->sole();
        $this->assertSame('local', $token->name);
        $this->assertTrue($token->expires_at->between(now()->addDays(6), now()->addDays(8)));

        $this->artisan('studio:token', ['--list' => true])->expectsOutputToContain('local')->assertSuccessful();
        $this->artisan('studio:token', ['--revoke' => (string) $token->id])->assertSuccessful();
        $this->assertDatabaseCount('studio_tokens', 0);

        $this->artisan('studio:token', ['--days' => 0])->assertFailed();
    }
}
