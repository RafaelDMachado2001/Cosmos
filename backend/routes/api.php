<?php

declare(strict_types=1);

use App\Http\Middleware\VerifyGoogleOidc;
use App\Modules\Content\Http\Controllers\Api\PublicationController;
use App\Modules\Content\Http\Controllers\Internal\TickController;
use App\Modules\Identity\Http\Controllers\MeController;
use Illuminate\Support\Facades\Route;

Route::get('/publications', [PublicationController::class, 'index']);
Route::get('/publications/{slug}', [PublicationController::class, 'show']);

Route::get('/me', [MeController::class, 'show']);
Route::middleware('auth:sanctum')->group(function (): void {
    Route::patch('/me', [MeController::class, 'update']);
    Route::delete('/me', [MeController::class, 'destroy']);
    Route::get('/me/export', [MeController::class, 'export']);
});

Route::post('/internal/tick', TickController::class)->middleware(VerifyGoogleOidc::class);
