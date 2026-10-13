<?php

use App\Http\Controllers\FallbackController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/{locale}/{segment}/{slug}', [FallbackController::class, 'show'])
    ->where('locale', 'pt|en')
    // Os segmentos traduzidos sao os mesmos de `src/core/routing.ts`. Mudar um
    // sem o outro e como o endereco do outro idioma virava 200 antes da fase 6.
    ->where('segment', 'publicacoes|publications')
    ->where('slug', '[a-z0-9]+(?:-[a-z0-9]+)*');
