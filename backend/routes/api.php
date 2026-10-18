<?php

declare(strict_types=1);

use App\Http\Controllers\Api\PublicationController;
use App\Http\Controllers\Internal\TickController;
use App\Http\Middleware\VerifyGoogleOidc;
use Illuminate\Support\Facades\Route;

/**
 * A API pública, só de leitura.
 *
 * Os parâmetros são os mesmos que `PublicationsSource` no frontend já
 * espelhava desde a fase 1 — `locale`, `category`, `q`, `before`, `limit` —
 * para que trocar o adapter estático pelo HTTP não mexa na constelação.
 */
Route::get('/publications', [PublicationController::class, 'index']);
Route::get('/publications/{slug}', [PublicationController::class, 'show']);

// O tick do Cloud Scheduler: só com o token OIDC da conta de serviço dele.
Route::post('/internal/tick', TickController::class)->middleware(VerifyGoogleOidc::class);
