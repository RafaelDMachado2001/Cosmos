<?php

declare(strict_types=1);

namespace App\Modules\Identity\Console\Commands;

use App\Modules\Identity\Actions\SignInWithProvider;
use App\Modules\Identity\Auth\ProviderProfile;
use Illuminate\Console\Command;
use Illuminate\Cookie\CookieValuePrefix;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Crypt;

/**
 * Uma sessão de leitor, para o e2e do site com sessão.
 *
 * O mesmo padrão do e2e:admin-session: sem rota de login de teste, a sessão
 * vai direto para o driver e o cookie sai criptografado. A conta passa pelo
 * mesmo SignInWithProvider do login de verdade, com um provedor fictício
 * (`google`, id `e2e`). Recusa rodar fora de `local`/`testing`.
 */
class E2eMemberSession extends Command
{
    protected $signature = 'e2e:member-session';

    protected $description = 'Imprime o cookie de uma sessão autenticada de leitor (só local/testing)';

    public function handle(SignInWithProvider $signIn): int
    {
        if (! app()->environment(['local', 'testing'])) {
            $this->error('Só roda com APP_ENV=local ou testing.');

            return self::FAILURE;
        }

        $member = $signIn->handle(new ProviderProfile(
            provider: 'google',
            id: 'e2e',
            name: 'Leitora E2E',
            email: 'leitora.e2e@example.test',
            emailVerified: true,
            avatar: null,
        ), 'pt');

        $session = app('session')->driver();
        $session->start();
        Auth::guard('member')->login($member);
        $session->save();

        /** @var string $name */
        $name = config('session.cookie');
        $value = Crypt::encrypt(CookieValuePrefix::create($name, Crypt::getKey()).$session->getId(), false);

        $this->line((string) json_encode(['name' => $name, 'value' => $value], JSON_THROW_ON_ERROR));

        return self::SUCCESS;
    }
}
