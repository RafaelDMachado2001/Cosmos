<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Modules\Identity\Models\Member;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class E2eMemberSessionTest extends TestCase
{
    use RefreshDatabase;

    public function test_o_cookie_impresso_abre_a_conta_do_leitor(): void
    {
        $this->assertSame(0, Artisan::call('e2e:member-session'));
        /** @var array{name: string, value: string} $cookie */
        $cookie = json_decode(trim(Artisan::output()), true, flags: JSON_THROW_ON_ERROR);

        $this->withUnencryptedCookie($cookie['name'], $cookie['value'])
            ->withHeader('Referer', 'http://localhost/pt/')
            ->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('data.name', 'Leitora E2E');
    }

    public function test_rodar_de_novo_reaproveita_a_conta(): void
    {
        Artisan::call('e2e:member-session');
        Artisan::call('e2e:member-session');

        $this->assertSame(1, Member::count());
    }

    public function test_recusa_fora_de_local_e_testing(): void
    {
        $this->app->detectEnvironment(fn (): string => 'production');

        $this->artisan('e2e:member-session')->assertFailed();
        $this->assertSame(0, Member::count());
    }
}
