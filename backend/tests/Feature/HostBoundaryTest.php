<?php

declare(strict_types=1);

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class HostBoundaryTest extends TestCase
{
    use RefreshDatabase;

    private const string ADMIN = 'admin.rdmlabs.test';

    private const string API = 'api.rdmlabs.test';

    protected function setUp(): void
    {
        parent::setUp();
        config(['hosts.admin' => self::ADMIN, 'hosts.api' => self::API, 'session.domain' => '.rdmlabs.test']);
    }

    public function test_o_cookie_do_admin_e_proprio_e_preso_ao_host(): void
    {
        $response = $this->get('http://'.self::ADMIN.'/admin/login')->assertOk();

        $cookie = collect($response->headers->getCookies())->firstWhere(fn ($cookie) => $cookie->getName() === 'rdm_admin');
        $this->assertNotNull($cookie, 'sem o cookie rdm_admin');
        // Sem Domain: o navegador só o devolve para este host, nunca ao do site.
        $this->assertNull($cookie->getDomain());
    }

    public function test_o_painel_nao_responde_no_host_da_api(): void
    {
        $this->get('http://'.self::API.'/admin/login')->assertNotFound();
        $this->get('http://'.self::API.'/admin/studio')->assertNotFound();
    }

    public function test_a_api_nao_responde_no_host_do_admin(): void
    {
        $this->get('http://'.self::ADMIN.'/api/publications')->assertNotFound();
        $this->get('http://'.self::API.'/api/publications')->assertOk();
    }

    public function test_outro_host_nao_responde_nada_alem_do_health_check(): void
    {
        $this->get('http://cosmos-api-xyz.a.run.app/api/publications')->assertNotFound();
        $this->get('http://cosmos-api-xyz.a.run.app/up')->assertOk();
    }

    public function test_sem_hosts_configurados_tudo_responde_como_no_compose(): void
    {
        config(['hosts.admin' => null, 'hosts.api' => null]);

        $this->get('http://localhost/admin/login')->assertOk();
        $this->get('http://localhost/api/publications')->assertOk();
    }

    public function test_sem_o_segredo_da_borda_o_contenedor_nao_responde(): void
    {
        config(['hosts.edge_secret' => 's3gredo']);

        $this->get('http://'.self::API.'/api/publications')->assertNotFound();
        $this->get('http://'.self::API.'/api/publications', ['X-Edge-Secret' => 'errado'])->assertNotFound();
        $this->get('http://cosmos-api-xyz.a.run.app/up')->assertOk();
    }

    public function test_pela_borda_vale_o_host_original_do_x_forwarded_host(): void
    {
        config(['hosts.edge_secret' => 's3gredo']);
        $edge = ['X-Edge-Secret' => 's3gredo', 'X-Forwarded-Host' => self::ADMIN, 'X-Forwarded-Proto' => 'https'];

        // A requisição chega no host do run.app, como o Worker a entrega.
        $response = $this->get('http://cosmos-api-xyz.a.run.app/admin/login', $edge)->assertOk();
        $this->assertNotNull(collect($response->headers->getCookies())->firstWhere(fn ($cookie) => $cookie->getName() === 'rdm_admin'));

        $this->get('http://cosmos-api-xyz.a.run.app/admin/login', [...$edge, 'X-Forwarded-Host' => self::API])->assertNotFound();
    }
}
