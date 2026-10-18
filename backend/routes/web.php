<?php

use App\Http\Controllers\Auth\GoogleAuthController;
use App\Modules\Content\Http\Controllers\Admin\MediaController;
use App\Modules\Content\Http\Controllers\Admin\PublicationAdminController;
use App\Modules\Content\Http\Controllers\Admin\RdmStudioController;
use App\Modules\Content\Http\Controllers\Admin\TagController;
use App\Modules\Content\Http\Controllers\FallbackController;
use App\Modules\Identity\Http\Controllers\MemberAuthController;
use Illuminate\Support\Facades\Route;

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
 * Login do leitor (guard `member`), no host da API. Mesmo throttle do painel.
 */
Route::middleware('throttle:10,1')->prefix('auth/{provider}')->whereIn('provider', ['google', 'github'])->group(function (): void {
    Route::get('/redirect', [MemberAuthController::class, 'redirect'])->name('member.auth.redirect');
    Route::get('/callback', [MemberAuthController::class, 'callback'])->name('member.auth.callback');
});

/*
 * O middleware `auth` padrão do Laravel redireciona para `route('login')`
 * quando a requisição não espera JSON — e sem esta rota ele lançava
 * `RouteNotFoundException` em vez de redirecionar. O Filament tem a própria
 * tela (`GoogleLogin`, em `/admin/login` — já ocupado, por isso o caminho
 * diferente aqui) para o guard dele; isto só existe para as rotas que usam
 * o middleware `auth` genérico (`/admin/studio`, `/admin/api/*`).
 *
 * Precisa do prefixo `/admin/`: `docker/web/default.conf` só repassa ao
 * PHP-FPM os caminhos que casam `^/(api|admin|livewire)(/|$)` — um `/login`
 * sem prefixo cai no `location /` do site público (raiz `/srv/site`) e nunca
 * alcança o Laravel, por mais que a rota exista (visto direto no PHPUnit,
 * que não passa pelo Nginx, e só por isso não pegou isto antes).
 */
Route::get('/admin/login-gateway', fn () => redirect()->route('auth.google.redirect'))->name('login');

/*
 * O RDM Studio: a casca HTML e a API JSON que ela chama. `web` já é o grupo
 * padrão deste arquivo; `auth` é o guard `web` padrão, o mesmo que
 * `GoogleAuthController` autentica.
 */
Route::middleware('auth')->get('/admin/studio', [RdmStudioController::class, 'show'])->name('rdm-studio');

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
