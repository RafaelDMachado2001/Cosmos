<?php

declare(strict_types=1);

use App\Http\Middleware\VerifyGoogleOidc;
use App\Modules\Community\Http\Controllers\CommentController;
use App\Modules\Community\Http\Controllers\ReactionController;
use App\Modules\Content\Http\Controllers\Api\PublicationController;
use App\Modules\Content\Http\Controllers\Internal\TickController;
use App\Modules\Identity\Http\Controllers\MeController;
use Illuminate\Support\Facades\Route;

Route::get('/publications', [PublicationController::class, 'index']);
Route::get('/publications/{slug}', [PublicationController::class, 'show']);
Route::get('/publications/{slug}/comments', [CommentController::class, 'index']);
Route::get('/publications/{slug}/reactions', [ReactionController::class, 'count']);

Route::get('/me', [MeController::class, 'show']);
Route::middleware('auth:sanctum')->group(function (): void {
    Route::patch('/me', [MeController::class, 'update']);
    Route::delete('/me', [MeController::class, 'destroy']);
    Route::get('/me/export', [MeController::class, 'export']);

    Route::post('/me/comments', [CommentController::class, 'store'])->middleware('throttle:comments');
    Route::delete('/me/comments/{comment}', [CommentController::class, 'destroy'])->whereNumber('comment');

    Route::get('/me/reactions/{slug}', [ReactionController::class, 'show']);
    Route::put('/me/reactions/{slug}', [ReactionController::class, 'store']);
    Route::delete('/me/reactions/{slug}', [ReactionController::class, 'destroy']);
});

Route::post('/internal/tick', TickController::class)->middleware(VerifyGoogleOidc::class);
