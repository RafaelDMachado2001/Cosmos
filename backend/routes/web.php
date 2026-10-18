<?php

use App\Http\Controllers\Admin\MediaController;
use App\Http\Controllers\Admin\PublicationAdminController;
use App\Http\Controllers\Admin\TagController;
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

/*
 * A API do RDM Studio. `web` já é o grupo padrão deste arquivo; `auth` é o
 * guard `web` padrão, o mesmo que `GoogleAuthController` autentica.
 */
Route::middleware('auth')->prefix('admin/api')->group(function (): void {
    Route::get('/publications', [PublicationAdminController::class, 'index']);
    Route::post('/publications', [PublicationAdminController::class, 'store']);
    Route::get('/publications/{publication}', [PublicationAdminController::class, 'show']);
    Route::patch('/publications/{publication}', [PublicationAdminController::class, 'update']);
    Route::delete('/publications/{publication}', [PublicationAdminController::class, 'destroy']);
    Route::post('/publications/{publication}/publish', [PublicationAdminController::class, 'publish']);
    Route::post('/publications/{publication}/unpublish', [PublicationAdminController::class, 'unpublish']);
    Route::post('/media', [MediaController::class, 'store']);
    Route::get('/tags', [TagController::class, 'index']);
});

Route::get('/{locale}/{segment}/{slug}', [FallbackController::class, 'show'])
    ->where('locale', 'pt|en')
    // Os segmentos traduzidos sao os mesmos de `src/core/routing.ts`. Mudar um
    // sem o outro e como o endereco do outro idioma virava 200 antes da fase 6.
    ->where('segment', 'publicacoes|publications')
    ->where('slug', '[a-z0-9]+(?:-[a-z0-9]+)*');
