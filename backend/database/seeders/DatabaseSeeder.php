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
         * é por aqui que o primeiro e único administrador nasce. A senha vem do
         * ambiente para não existir credencial escrita no repositório.
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
