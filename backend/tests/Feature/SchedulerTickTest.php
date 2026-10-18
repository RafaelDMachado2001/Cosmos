<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Publication;
use Firebase\JWT\JWT;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Testing\TestResponse;
use OpenSSLAsymmetricKey;
use Tests\TestCase;

/**
 * O tick contra um "Google" de mentira: um par RSA gerado aqui, publicado no
 * mesmo formato JWKS que https://www.googleapis.com/oauth2/v3/certs devolve.
 */
class SchedulerTickTest extends TestCase
{
    use RefreshDatabase;

    private const string AUDIENCE = 'https://api.rdmlabs.test/api/internal/tick';

    private const string ACCOUNT = 'scheduler@rdm-labs.iam.gserviceaccount.com';

    private OpenSSLAsymmetricKey $key;

    protected function setUp(): void
    {
        parent::setUp();

        $key = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
        $this->assertNotFalse($key);
        $this->key = $key;
        $rsa = openssl_pkey_get_details($key)['rsa'];

        Http::fake(['www.googleapis.com/*' => Http::response(['keys' => [[
            'kty' => 'RSA',
            'alg' => 'RS256',
            'use' => 'sig',
            'kid' => 'k1',
            'n' => rtrim(strtr(base64_encode($rsa['n']), '+/', '-_'), '='),
            'e' => rtrim(strtr(base64_encode($rsa['e']), '+/', '-_'), '='),
        ]]])]);

        config([
            'scheduler.oidc_audience' => self::AUDIENCE,
            'scheduler.service_account' => self::ACCOUNT,
        ]);
    }

    /** @param  array<string, mixed>  $overrides */
    private function token(array $overrides = []): string
    {
        return JWT::encode([
            'iss' => 'https://accounts.google.com',
            'aud' => self::AUDIENCE,
            'email' => self::ACCOUNT,
            'email_verified' => true,
            'iat' => time(),
            'exp' => time() + 300,
            ...$overrides,
        ], $this->key, 'RS256', 'k1');
    }

    private function tick(?string $token): TestResponse
    {
        return $this->postJson('/api/internal/tick', [], $token === null ? [] : ['Authorization' => 'Bearer '.$token]);
    }

    public function test_sem_token_e_401(): void
    {
        $this->tick(null)->assertUnauthorized();
    }

    public function test_token_de_outra_audiencia_e_401(): void
    {
        $this->tick($this->token(['aud' => 'https://outro.servico/']))->assertUnauthorized();
    }

    public function test_token_de_outra_conta_e_401(): void
    {
        $this->tick($this->token(['email' => 'intruso@gmail.com']))->assertUnauthorized();
    }

    public function test_token_vencido_e_401(): void
    {
        $this->tick($this->token(['iat' => time() - 7200, 'exp' => time() - 3600]))->assertUnauthorized();
    }

    public function test_token_assinado_por_outra_chave_e_401(): void
    {
        $other = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
        $this->assertNotFalse($other);
        $forged = JWT::encode([
            'iss' => 'https://accounts.google.com',
            'aud' => self::AUDIENCE,
            'email' => self::ACCOUNT,
            'email_verified' => true,
            'exp' => time() + 300,
        ], $other, 'RS256', 'k1');

        $this->tick($forged)->assertUnauthorized();
    }

    public function test_sem_configuracao_recusa_ate_token_valido(): void
    {
        $token = $this->token();
        config(['scheduler.oidc_audience' => null]);

        $this->tick($token)->assertUnauthorized();
    }

    public function test_token_valido_publica_o_que_venceu(): void
    {
        $publication = Publication::create([
            'slug' => 'agendada',
            'category' => 'artigo',
            'published_at' => now()->subMinute(),
            'featured' => false,
            'status' => Publication::STATUS_SCHEDULED,
        ]);

        $this->tick($this->token())->assertOk()->assertJsonStructure(['rebuilt']);

        $this->assertSame(Publication::STATUS_PUBLISHED, $publication->refresh()->status);
    }
}
