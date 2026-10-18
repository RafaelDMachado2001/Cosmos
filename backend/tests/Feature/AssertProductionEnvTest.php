<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Console\Commands\AssertProductionEnv;
use Tests\TestCase;

class AssertProductionEnvTest extends TestCase
{
    private function production(): void
    {
        config([
            'app.env' => 'production',
            'app.debug' => false,
            'app.key' => 'base64:'.base64_encode(str_repeat('k', 32)),
            'app.url' => 'https://admin.rdmlabs.com.br',
            'session.secure' => true,
            'session.domain' => '.rdmlabs.com.br',
            'filesystems.disks.media.driver' => 's3',
            'filesystems.disks.media.bucket' => 'rdm-labs-media',
            'filesystems.disks.media.url' => 'https://media.rdmlabs.com.br',
            'publishing.rebuild_driver' => 'vercel',
            'publishing.vercel_deploy_hook' => 'https://api.vercel.com/v1/integrations/deploy/x',
            'scheduler.oidc_audience' => 'https://api.rdmlabs.com.br/api/internal/tick',
            'scheduler.service_account' => 'scheduler@x.iam.gserviceaccount.com',
            'hosts.admin' => 'admin.rdmlabs.com.br',
            'hosts.api' => 'api.rdmlabs.com.br',
        ]);
    }

    public function test_a_configuracao_completa_passa(): void
    {
        $this->production();

        $this->assertSame([], AssertProductionEnv::problems());
        $this->artisan('env:assert-production')->assertSuccessful();
    }

    public function test_cada_esquecimento_derruba_o_boot(): void
    {
        $this->production();
        config(['app.debug' => true, 'session.secure' => false, 'filesystems.disks.media.driver' => 'local']);

        $this->assertSame([
            'APP_DEBUG precisa ser false',
            'SESSION_SECURE_COOKIE precisa ser true',
            'MEDIA_DISK precisa ser s3: o disco do contêiner some',
        ], AssertProductionEnv::problems());
        $this->artisan('env:assert-production')->assertFailed();
    }

    public function test_o_ambiente_de_teste_nao_passa_por_producao(): void
    {
        $this->artisan('env:assert-production')->assertFailed();
    }
}
