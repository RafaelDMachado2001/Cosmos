<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RdmStudioTest extends TestCase
{
    use RefreshDatabase;

    public function test_exige_autenticacao(): void
    {
        $this->get('/admin/studio')->assertRedirect();
    }

    public function test_autenticado_recebe_a_casca_com_o_token_csrf_e_o_mount_point(): void
    {
        $response = $this->actingAs(User::factory()->create())->get('/admin/studio');

        $response->assertOk();
        $response->assertSee('id="admin-root"', false);
        $response->assertSee('name="csrf-token"', false);
        $response->assertSee('rdm-studio/admin.js', false);
    }
}
