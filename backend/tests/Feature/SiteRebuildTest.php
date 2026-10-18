<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Jobs\RegenerateSite;
use App\Models\Publication;
use App\Support\SiteRebuild;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class SiteRebuildTest extends TestCase
{
    use RefreshDatabase;

    private const string HOOK = 'https://api.vercel.com/v1/integrations/deploy/prj_x/abc';

    private function vercel(): void
    {
        config([
            'publishing.rebuild_driver' => 'vercel',
            'publishing.vercel_deploy_hook' => self::HOOK,
            'publishing.rebuild_min_interval' => 60,
        ]);
    }

    public function test_o_driver_local_continua_enfileirando_o_prerender(): void
    {
        Queue::fake();
        Http::fake();

        SiteRebuild::request();

        Queue::assertPushed(RegenerateSite::class);
        Http::assertNothingSent();
    }

    public function test_salvar_dispara_o_hook_depois_da_resposta_sem_worker(): void
    {
        $this->vercel();
        Http::fake([self::HOOK => Http::response(['job' => ['id' => 'x']], 201)]);

        // O defer roda quando a aplicação termina o request; no teste, na hora.
        $this->withoutDefer();
        Publication::create([
            'slug' => 'nova',
            'category' => 'artigo',
            'published_at' => now(),
            'featured' => false,
            'status' => Publication::STATUS_PUBLISHED,
        ]);

        Http::assertSent(static fn (Request $request): bool => $request->url() === self::HOOK && $request->method() === 'POST');
        Http::assertSentCount(1);
    }

    public function test_uma_rajada_de_salvamentos_custa_um_build_e_o_tick_leva_o_resto(): void
    {
        $this->vercel();
        Http::fake([self::HOOK => Http::response([], 201)]);

        SiteRebuild::request();
        $this->assertTrue(SiteRebuild::flush());

        // Edições dentro do intervalo: ficam pendentes, sem novo disparo.
        SiteRebuild::request();
        SiteRebuild::request();
        $this->assertFalse(SiteRebuild::flush());
        Http::assertSentCount(1);

        // O tick, passado o intervalo, leva a pendência num build só.
        $this->travel(61)->seconds();
        $this->assertTrue(SiteRebuild::flush());
        $this->assertFalse(SiteRebuild::flush());
        Http::assertSentCount(2);
    }

    public function test_sem_mudanca_pendente_o_tick_nao_dispara(): void
    {
        $this->vercel();
        Http::fake();

        $this->assertFalse(SiteRebuild::flush());
        Http::assertNothingSent();
    }

    public function test_falha_do_hook_mantem_o_site_sujo_para_a_proxima_tentativa(): void
    {
        $this->vercel();
        Http::fakeSequence(self::HOOK)->push('erro', 500)->push([], 201);

        SiteRebuild::request();
        $this->assertFalse(SiteRebuild::flush());

        // Falha não conta como disparo: a próxima tentativa não espera o intervalo.
        $this->assertTrue(SiteRebuild::flush());
    }
}
