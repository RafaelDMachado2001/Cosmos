<?php

declare(strict_types=1);

use App\Http\Controllers\Admin\StudioTokenController;
use App\Http\Middleware\AuthenticateStudioToken;
use App\Http\Middleware\VerifyGoogleOidc;
use App\Modules\Community\Http\Controllers\CommentController;
use App\Modules\Community\Http\Controllers\ReactionController;
use App\Modules\Content\Http\Controllers\Admin\MediaController;
use App\Modules\Content\Http\Controllers\Admin\PublicationAdminController;
use App\Modules\Content\Http\Controllers\Admin\StudioToolsController;
use App\Modules\Content\Http\Controllers\Admin\TagController;
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

Route::middleware(AuthenticateStudioToken::class)->prefix('studio')->group(function (): void {
    Route::get('/me', [StudioTokenController::class, 'current']);
    Route::get('/publications', [PublicationAdminController::class, 'index']);
    Route::post('/publications', [PublicationAdminController::class, 'store']);
    Route::get('/publications/{publication}', [PublicationAdminController::class, 'show']);
    Route::patch('/publications/{publication}', [PublicationAdminController::class, 'update']);
    Route::get('/publications/{publication}/preview', [StudioToolsController::class, 'preview']);
    Route::post('/publications/{publication}/publish', [PublicationAdminController::class, 'publish']);
    Route::post('/publications/{publication}/unpublish', [PublicationAdminController::class, 'unpublish']);
    Route::post('/media', [MediaController::class, 'store']);
    Route::get('/tags', [TagController::class, 'index']);
    Route::post('/convert/markdown-to-blocks', [StudioToolsController::class, 'toBlocks']);
    Route::post('/convert/blocks-to-markdown', [StudioToolsController::class, 'toMarkdown']);
});

Route::post('/internal/tick', TickController::class)->middleware(VerifyGoogleOidc::class);
