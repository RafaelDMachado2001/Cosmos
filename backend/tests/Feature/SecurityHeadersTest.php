<?php

declare(strict_types=1);

namespace Tests\Feature;

use Tests\TestCase;

class SecurityHeadersTest extends TestCase
{
    public function test_a_tela_de_login_recusa_ser_exibida_num_iframe(): void
    {
        $response = $this->get('/admin/login');

        $response->assertHeader('X-Frame-Options', 'DENY');
        $response->assertHeader('Content-Security-Policy', "frame-ancestors 'none'");
    }

    public function test_a_api_publica_tambem_sai_com_nosniff_e_referrer_policy(): void
    {
        $response = $this->get('/api/publications');

        $response->assertHeader('X-Content-Type-Options', 'nosniff');
        $response->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    }

    public function test_nada_do_backend_entra_no_indice_dos_buscadores(): void
    {
        $this->get('/admin/login')->assertHeader('X-Robots-Tag', 'noindex, nofollow');
        $this->get('/api/publications')->assertHeader('X-Robots-Tag', 'noindex, nofollow');
    }
}
