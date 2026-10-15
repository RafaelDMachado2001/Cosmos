<?php

use App\Http\Controllers\Auth\GoogleAuthController;
use App\Http\Controllers\FallbackController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

/*
 * Login do painel por Google — fora do middleware de autenticação do
 * Filament de propósito, são o caminho de entrada. `throttle:10,1` nas duas:
 * dez por minuto por IP é folgado para uso normal e curto o bastante para
 * não valer a pena como superfície de abuso.
 */
Route::middleware('throttle:10,1')->group(function (): void {
    Route::get('/admin/login/google', [GoogleAuthController::class, 'redirect'])
        ->name('auth.google.redirect');
    Route::get('/admin/login/google/callback', [GoogleAuthController::class, 'callback'])
        ->name('auth.google.callback');
});

Route::get('/{locale}/{segment}/{slug}', [FallbackController::class, 'show'])
    ->where('locale', 'pt|en')
    // Os segmentos traduzidos sao os mesmos de `src/core/routing.ts`. Mudar um
    // sem o outro e como o endereco do outro idioma virava 200 antes da fase 6.
    ->where('segment', 'publicacoes|publications')
    ->where('slug', '[a-z0-9]+(?:-[a-z0-9]+)*');
