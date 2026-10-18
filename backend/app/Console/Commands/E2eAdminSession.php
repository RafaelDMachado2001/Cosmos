<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Cookie\CookieValuePrefix;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Crypt;

/**
 * Uma sessão autenticada do admin, para o e2e do RDM Studio.
 *
 * O painel só entra por Google, e o CI não tem como passar pelo OAuth. Em vez
 * de uma rota de login de teste — uma porta a mais no código servido —, isto
 * grava a sessão direto no driver configurado e imprime o cookie já
 * criptografado, do jeito que `EncryptCookies` o espera; o Playwright só o
 * injeta no navegador. Recusa rodar fora de `local`/`testing`: em produção o
 * comando existe, mas não faz nada.
 */
class E2eAdminSession extends Command
{
    protected $signature = 'e2e:admin-session';

    protected $description = 'Imprime o cookie de uma sessão autenticada do admin (só local/testing)';

    public function handle(): int
    {
        if (! app()->environment(['local', 'testing'])) {
            $this->error('Só roda com APP_ENV=local ou testing.');

            return self::FAILURE;
        }

        $user = User::query()->where('email', config('admin.email'))->first();

        if ($user === null) {
            $this->error('O admin não existe; rode o DatabaseSeeder antes.');

            return self::FAILURE;
        }

        $session = app('session')->driver();
        $session->start();
        Auth::guard('web')->login($user);
        $session->save();

        /** @var string $name */
        $name = config('session.cookie');
        $value = Crypt::encrypt(CookieValuePrefix::create($name, Crypt::getKey()).$session->getId(), false);

        $this->line((string) json_encode(['name' => $name, 'value' => $value], JSON_THROW_ON_ERROR));

        return self::SUCCESS;
    }
}
