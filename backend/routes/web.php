<?php

use App\Http\Controllers\Admin\StudioTokenController;
use App\Http\Controllers\Auth\GoogleAuthController;
use App\Modules\Content\Http\Controllers\Admin\MediaController;
use App\Modules\Content\Http\Controllers\Admin\PublicationAdminController;
use App\Modules\Content\Http\Controllers\Admin\RdmStudioController;
use App\Modules\Content\Http\Controllers\Admin\TagController;
use App\Modules\Content\Http\Controllers\FallbackController;
use App\Modules\Identity\Http\Controllers\MeController;
use App\Modules\Identity\Http\Controllers\MemberAuthController;
use Illuminate\Support\Facades\Route;

Route::middleware('throttle:10,1')->group(function (): void {
    Route::get('/admin/login/google', [GoogleAuthController::class, 'redirect'])
        ->name('auth.google.redirect');
    Route::get('/admin/login/google/callback', [GoogleAuthController::class, 'callback'])
        ->name('auth.google.callback');
});

Route::post('/auth/logout', [MeController::class, 'logout'])->name('member.auth.logout');
Route::middleware('throttle:10,1')->prefix('auth/{provider}')->whereIn('provider', ['google', 'github'])->group(function (): void {
    Route::get('/redirect', [MemberAuthController::class, 'redirect'])->name('member.auth.redirect');
    Route::get('/callback', [MemberAuthController::class, 'callback'])->name('member.auth.callback');
});

Route::get('/admin/login-gateway', fn () => redirect()->route('auth.google.redirect'))->name('login');

Route::middleware('auth')->get('/admin/studio', [RdmStudioController::class, 'show'])->name('rdm-studio');

Route::middleware('auth')->prefix('admin/studio/tokens')->name('studio-tokens.')->group(function (): void {
    Route::get('/', [StudioTokenController::class, 'index'])->name('index');
    Route::post('/', [StudioTokenController::class, 'store'])->name('store');
    Route::delete('/{token}', [StudioTokenController::class, 'destroy'])->whereNumber('token')->name('destroy');
});

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
    ->where('segment', 'publicacoes|publications')
    ->where('slug', '[a-z0-9]+(?:-[a-z0-9]+)*');
