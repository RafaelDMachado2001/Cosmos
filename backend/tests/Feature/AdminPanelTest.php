<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Modules\Content\Filament\Resources\Publications\Pages\CreatePublication;
use App\Modules\Content\Filament\Resources\Publications\Pages\ListPublications;
use App\Modules\Content\Models\Publication;
use Database\Seeders\PublicationSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

class AdminPanelTest extends TestCase
{
    use RefreshDatabase;

    public function test_o_painel_exige_autenticacao(): void
    {
        $this->get('/admin/publications')->assertRedirect('/admin/login');
    }

    public function test_o_admin_do_allowlist_entra_no_painel_fora_do_local(): void
    {
        // O Filament só deixa qualquer usuário entrar com APP_ENV=local; aqui é
        // testing, como em produção. Sem canAccessPanel, o login funcionava e
        // o /admin respondia 403 (achado na virada).
        $this->actingAs(User::factory()->create(['email' => strtoupper((string) config('admin.email'))]));

        $this->get('/admin')->assertOk();
    }

    public function test_outro_usuario_autenticado_nao_entra_no_painel(): void
    {
        $this->actingAs(User::factory()->create(['email' => 'outra.pessoa@example.com']));

        $this->get('/admin')->assertForbidden();
    }

    public function test_nao_existe_registro_publico(): void
    {
        // O painel é de um autor só. Uma rota de registro aberta seria um
        // caminho para qualquer pessoa publicar na constelação.
        $this->get('/admin/register')->assertNotFound();
    }

    public function test_lista_as_publicacoes(): void
    {
        $this->actingAs(User::factory()->create());
        $this->seed(PublicationSeeder::class);

        // A primeira página, na mesma ordem da constelação: do mais novo para o
        // mais antigo. O acervo semente tem catorze e a página mostra dez.
        $primeiraPagina = Publication::query()
            ->orderByDesc('published_at')
            ->limit(10)
            ->get();

        Livewire::test(ListPublications::class)
            ->assertCanSeeTableRecords($primeiraPagina)
            ->assertCountTableRecords(14);
    }

    public function test_publicacao_agendada_mostra_situacao_propria(): void
    {
        $this->actingAs(User::factory()->create());

        $agendada = Publication::create([
            'slug' => 'agendada-no-painel',
            'category' => 'artigo',
            'published_at' => now()->addWeek(),
            'featured' => false,
            'status' => Publication::STATUS_PUBLISHED,
        ]);

        // "Publicado" com data futura não aparece na API pública ainda — o
        // painel precisa dizer isso, não só repetir o status do banco.
        Livewire::test(ListPublications::class)
            ->assertTableColumnFormattedStateSet('status', 'Agendado', $agendada);
    }

    public function test_publica_um_item_novo_com_as_duas_traducoes(): void
    {
        $this->actingAs(User::factory()->create());

        Livewire::test(CreatePublication::class)
            ->fillForm([
                'slug' => 'nova-publicacao',
                'category' => 'artigo',
                'published_at' => '2026-10-01 12:00:00',
                'status' => Publication::STATUS_PUBLISHED,
                'featured' => false,
                'translations' => [
                    ['locale' => 'pt', 'title' => 'Título', 'summary' => 'Resumo', 'body' => "Um.\n\nDois."],
                    ['locale' => 'en', 'title' => 'Title', 'summary' => 'Summary', 'body' => "One.\n\nTwo."],
                ],
            ])
            ->call('create')
            ->assertHasNoFormErrors();

        $publication = Publication::where('slug', 'nova-publicacao')->firstOrFail();
        $this->assertCount(2, $publication->translations);

        // O caminho inteiro: o que o painel grava chega à API pública já
        // indexado — o `search_vector` é coluna gerada, não gatilho.
        $this->getJson('/api/publications/nova-publicacao?locale=en')
            ->assertOk()
            ->assertJsonPath('data.title', 'Title')
            ->assertJsonPath('data.body', "One.\n\nTwo.");

        $this->getJson('/api/publications?locale=pt&q=resumo')
            ->assertOk()
            ->assertJsonPath('data.0.slug', 'nova-publicacao');
    }

    public function test_recusa_slug_com_acento_ou_maiuscula(): void
    {
        $this->actingAs(User::factory()->create());

        // O slug alimenta o FNV-1a que decide a altura da estrela, e ele
        // precisa render o mesmo inteiro sobre bytes UTF-8 aqui e sobre code
        // units UTF-16 no navegador.
        Livewire::test(CreatePublication::class)
            ->fillForm([
                'slug' => 'Ação-Inválida',
                'category' => 'artigo',
                'published_at' => '2026-10-01 12:00:00',
                'status' => Publication::STATUS_DRAFT,
                'translations' => [
                    ['locale' => 'pt', 'title' => 'T', 'summary' => 'R', 'body' => 'C'],
                ],
            ])
            ->call('create')
            ->assertHasFormErrors(['slug']);
    }
}
