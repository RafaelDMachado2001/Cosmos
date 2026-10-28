<?php

namespace App\Providers\Filament;

use App\Filament\Pages\Auth\GoogleLogin;
use Filament\Http\Middleware\Authenticate;
use Filament\Http\Middleware\AuthenticateSession;
use Filament\Http\Middleware\DisableBladeIconComponents;
use Filament\Http\Middleware\DispatchServingFilamentEvent;
use Filament\Navigation\NavigationItem;
use Filament\Pages\Dashboard;
use Filament\Panel;
use Filament\PanelProvider;
use Filament\Support\Colors\Color;
use Filament\Support\Icons\Heroicon;
use Filament\Widgets\AccountWidget;
use Filament\Widgets\FilamentInfoWidget;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\Support\HtmlString;
use Illuminate\View\Middleware\ShareErrorsFromSession;

class AdminPanelProvider extends PanelProvider
{
    /** O `BrandMark` do Studio (`src/components/BrandMark`), com o nome ao lado. */
    private const BRAND_LOGO = <<<'HTML'
        <span style="display:flex;align-items:center;gap:.6rem;height:100%;font-weight:600">
            <svg viewBox="0 0 32 32" aria-hidden="true" style="height:100%;width:auto">
                <circle cx="16" cy="16" r="11" fill="none" stroke="#C9CBE0" stroke-opacity="0.55" stroke-width="2.4"/>
                <circle cx="16" cy="16" r="5" fill="#F2F1FA"/>
                <circle cx="16" cy="27" r="4" fill="#FF8A4C"/>
            </svg>
            RDM Studio
        </span>
        HTML;

    public function panel(Panel $panel): Panel
    {
        return $panel
            ->default()
            ->id('admin')
            ->path('admin')
            ->login(GoogleLogin::class)
            // A marca do RDM Studio: a cor dele (`--color-brand-studio` em
            // tokens.css) e o mesmo logo do Studio em React. Sempre escuro: o
            // núcleo do logo é quase branco e sumiria no tema claro.
            ->colors([
                'primary' => Color::hex('#ff8a4c'),
            ])
            ->darkMode(isForced: true)
            ->brandName('RDM Studio')
            ->brandLogo(fn (): HtmlString => new HtmlString(self::BRAND_LOGO))
            ->favicon(fn (): string => asset('admin/rdm-studio/favicon.svg'))
            ->discoverResources(in: app_path('Modules/Content/Filament/Resources'), for: 'App\Modules\Content\Filament\Resources')
            ->discoverPages(in: app_path('Filament/Pages'), for: 'App\Filament\Pages')
            ->pages([
                Dashboard::class,
            ])
            // O editor de verdade é o RDM Studio, fora do Filament (é React,
            // e o Livewire disputaria o DOM): o menu leva até ele.
            ->navigationItems([
                NavigationItem::make('RDM Studio')
                    ->url(fn (): string => route('rdm-studio'))
                    ->icon(Heroicon::OutlinedPencilSquare)
                    ->sort(-1),
            ])
            ->discoverWidgets(in: app_path('Filament/Widgets'), for: 'App\Filament\Widgets')
            ->widgets([
                AccountWidget::class,
                FilamentInfoWidget::class,
            ])
            ->middleware([
                EncryptCookies::class,
                AddQueuedCookiesToResponse::class,
                StartSession::class,
                AuthenticateSession::class,
                ShareErrorsFromSession::class,
                PreventRequestForgery::class,
                SubstituteBindings::class,
                DisableBladeIconComponents::class,
                DispatchServingFilamentEvent::class,
            ])
            ->authMiddleware([
                Authenticate::class,
            ]);
    }
}
