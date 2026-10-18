<?php

declare(strict_types=1);

namespace App\Filament\Pages\Auth;

use Filament\Actions\Action;
use Filament\Facades\Filament;
use Filament\Pages\SimplePage;
use Filament\Schemas\Components\Actions;
use Filament\Schemas\Schema;

/**
 * A tela de login do painel: um botão só, "Entrar com Google".
 *
 * Não estende `Filament\Auth\Pages\Login` de propósito — aquela classe
 * carrega formulário de credenciais, autenticação multifator e rate
 * limiting por tentativa de senha, e nada disso se aplica a um botão único.
 * `SimplePage` continua dando o layout, o logo e a moldura do painel.
 */
class GoogleLogin extends SimplePage
{
    public function mount(): void
    {
        if (Filament::auth()->check()) {
            redirect()->intended(Filament::getUrl());
        }
    }

    public function content(Schema $schema): Schema
    {
        return $schema->components([
            Actions::make([
                Action::make('google')
                    ->label('Entrar com Google')
                    ->url(route('auth.google.redirect'))
                    ->color('primary')
                    ->icon('heroicon-o-arrow-right-end-on-rectangle'),
            ])->fullWidth(),
        ]);
    }
}
