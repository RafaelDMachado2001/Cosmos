<?php

declare(strict_types=1);

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Sem o cabeçalho, o navegador esconde o status e mostra só "Failed to
 * fetch": o site não distingue um 404 de uma queda de rede.
 */
class PublicCorsTest extends TestCase
{
    use RefreshDatabase;

    private const ORIGIN = 'https://cosmos.example';

    public function test_a_leitura_publica_e_aberta_a_qualquer_origem(): void
    {
        $this->getJson('/api/publications', ['Origin' => self::ORIGIN])
            ->assertOk()
            ->assertHeader('Access-Control-Allow-Origin', '*');
    }

    public function test_o_404_de_publicacao_inexistente_tambem_leva_o_cabecalho(): void
    {
        $this->getJson('/api/publications/nao-existe', ['Origin' => self::ORIGIN])
            ->assertNotFound()
            ->assertHeader('Access-Control-Allow-Origin', '*');
    }

    public function test_o_404_de_rota_que_nao_existe_tambem_leva_o_cabecalho(): void
    {
        $this->getJson('/api/nada', ['Origin' => self::ORIGIN])
            ->assertNotFound()
            ->assertHeader('Access-Control-Allow-Origin', '*');
    }

    public function test_o_429_do_throttle_tambem_leva_o_cabecalho(): void
    {
        for ($i = 0; $i < 60; $i++) {
            $this->getJson('/api/publications', ['Origin' => self::ORIGIN])->assertOk();
        }

        $this->getJson('/api/publications', ['Origin' => self::ORIGIN])
            ->assertTooManyRequests()
            ->assertHeader('Access-Control-Allow-Origin', '*');
    }

    public function test_a_conta_do_leitor_nunca_recebe_a_origem_aberta(): void
    {
        $response = $this->getJson('/api/me', ['Origin' => self::ORIGIN]);

        $this->assertNotSame('*', $response->headers->get('Access-Control-Allow-Origin'));
    }

    public function test_fora_da_api_nada_muda(): void
    {
        $this->get('/up')->assertHeaderMissing('Access-Control-Allow-Origin');
    }
}
