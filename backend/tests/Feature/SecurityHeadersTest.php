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
}
