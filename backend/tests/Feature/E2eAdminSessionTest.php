<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class E2eAdminSessionTest extends TestCase
{
    use RefreshDatabase;

    public function test_o_cookie_impresso_abre_o_studio(): void
    {
        User::factory()->create(['email' => config('admin.email')]);

        $this->assertSame(0, Artisan::call('e2e:admin-session'));
        /** @var array{name: string, value: string} $cookie */
        $cookie = json_decode(trim(Artisan::output()), true, flags: JSON_THROW_ON_ERROR);

        // Sem criptografar de novo: o valor já sai como EncryptCookies o espera.
        $this->withUnencryptedCookie($cookie['name'], $cookie['value'])
            ->get('/admin/studio')
            ->assertOk()
            ->assertSee('id="admin-root"', false);
    }

    public function test_recusa_fora_de_local_e_testing(): void
    {
        User::factory()->create(['email' => config('admin.email')]);
        $this->app->detectEnvironment(fn (): string => 'production');

        $this->artisan('e2e:admin-session')->assertFailed();
    }

    public function test_sem_admin_falha(): void
    {
        $this->artisan('e2e:admin-session')->assertFailed();
    }
}
