<?php

declare(strict_types=1);

namespace App\Filament\Pages\Auth;

use Filament\Actions\Action;
use Filament\Facades\Filament;
use Filament\Pages\SimplePage;
use Filament\Schemas\Components\Actions;
use Filament\Schemas\Schema;

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
