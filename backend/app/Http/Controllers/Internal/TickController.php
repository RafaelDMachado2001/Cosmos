<?php

declare(strict_types=1);

namespace App\Http\Controllers\Internal;

use App\Http\Controllers\Controller;
use App\Support\SiteRebuild;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Artisan;

/**
 * O minuto do agendador, em produção.
 *
 * Com o Cloud Run escalando a zero não há `schedule:work` sempre ligado: o
 * Cloud Scheduler chama esta rota a cada minuto. Publica o que venceu e leva
 * a regeneração que ficou pendente (ver SiteRebuild).
 */
class TickController extends Controller
{
    public function __invoke(): JsonResponse
    {
        Artisan::call('publications:publish-scheduled');

        return response()->json(['rebuilt' => SiteRebuild::flush()]);
    }
}
