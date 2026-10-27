<?php

declare(strict_types=1);

use App\Http\Middleware\VerifyGoogleOidc;
use App\Modules\Content\Http\Controllers\Api\PublicationController;
use App\Modules\Content\Http\Controllers\Internal\TickController;
use App\Modules\Identity\Http\Controllers\MeController;
use Illuminate\Support\Facades\Route;

/**
 * A API pública, só de leitura.
 *
 * Os parâmetros são os mesmos que `PublicationsSource` no frontend já
 * espelhava desde a fase 1 — `locale`, `category`, `q`, `before`, `limit` —
 * para que trocar o adapter estático pelo HTTP não mexa na constelação. O
 * CORS aberto (`*`) vem do PublicCors, que é global (bootstrap/app.php).
 */
Route::get('/publications', [PublicationController::class, 'index']);
Route::get('/publications/{slug}', [PublicationController::class, 'show']);

// A conta do leitor: sessão do Sanctum vinda do site (config/sanctum.php),
// com CSRF e CORS de credenciais (config/cors.php).
Route::get('/me', [MeController::class, 'show']);
Route::middleware('auth:sanctum')->group(function (): void {
    Route::patch('/me', [MeController::class, 'update']);
    Route::delete('/me', [MeController::class, 'destroy']);
    Route::get('/me/export', [MeController::class, 'export']);
});

// O tick do Cloud Scheduler: só com o token OIDC da conta de serviço dele.
Route::post('/internal/tick', TickController::class)->middleware(VerifyGoogleOidc::class);
