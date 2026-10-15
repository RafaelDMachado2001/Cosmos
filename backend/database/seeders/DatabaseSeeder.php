<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        /**
         * O único acesso ao painel.
         *
         * O registro público está desligado — ver `AdminPanelProvider` — então
         * é por aqui que o primeiro e único administrador nasce. O login é por
         * Google (`GoogleAuthController`); este e-mail é o allowlist, e a senha
         * gerada aqui nunca autentica ninguém — só satisfaz a coluna
         * obrigatória do schema. Nenhuma credencial fica escrita no repositório.
         */
        User::updateOrCreate(
            ['email' => config('admin.email')],
            [
                'name' => config('admin.name'),
                'password' => Hash::make((string) config('admin.password')),
            ]
        );

        $this->call(PublicationSeeder::class);
    }
}
