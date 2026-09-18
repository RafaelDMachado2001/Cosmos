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
            ['email' => env('ADMIN_EMAIL', 'admin@rdmlabs.dev')],
            [
                'name' => env('ADMIN_NAME', 'RDM Labs'),
                'password' => Hash::make((string) env('ADMIN_PASSWORD', 'changeme')),
            ]
        );

        $this->call(PublicationSeeder::class);
    }
}
