<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\StudioToken;
use App\Models\User;
use Illuminate\Console\Command;

class StudioTokenCommand extends Command
{
    protected $signature = 'studio:token
        {--name=claude : Nome para reconhecer o token}
        {--days=90 : Validade em dias}
        {--list : Lista os tokens em vez de criar}
        {--revoke= : Revoga o token com este id}';

    protected $description = 'Cria, lista ou revoga tokens da API do Studio do admin';

    public function handle(): int
    {
        $admin = User::query()->whereRaw('lower(email) = lower(?)', [(string) config('admin.email')])->first();

        if ($admin === null) {
            $this->error('O admin não existe; entre uma vez pelo Google ou rode o DatabaseSeeder.');

            return self::FAILURE;
        }

        if ($this->option('list')) {
            $this->table(
                ['id', 'nome', 'expira', 'último uso'],
                $admin->studioTokens()->latest()->get()->map(fn (StudioToken $token): array => [
                    $token->id,
                    $token->name,
                    $token->expires_at->toDateString(),
                    $token->last_used_at?->toDateTimeString() ?? '—',
                ])->all(),
            );

            return self::SUCCESS;
        }

        $revoke = $this->option('revoke');
        if (is_string($revoke) && $revoke !== '') {
            $deleted = $admin->studioTokens()->whereKey((int) $revoke)->delete();
            $deleted > 0 ? $this->info("Token {$revoke} revogado.") : $this->warn("Nenhum token {$revoke}.");

            return $deleted > 0 ? self::SUCCESS : self::FAILURE;
        }

        $days = (int) $this->option('days');
        if ($days < 1 || $days > StudioToken::MAX_DAYS) {
            $this->error('A validade vai de 1 a '.StudioToken::MAX_DAYS.' dias.');

            return self::FAILURE;
        }

        $name = $this->option('name');
        [, $plain] = StudioToken::issue($admin, is_string($name) && $name !== '' ? $name : 'claude', $days);
        $this->line($plain);

        return self::SUCCESS;
    }
}
