<?php

declare(strict_types=1);

namespace App\Modules\Content\Http\Controllers\Internal;

use App\Http\Controllers\Controller;
use App\Modules\Content\Support\ScheduledPublisher;
use App\Modules\Content\Support\SiteRebuild;
use Illuminate\Http\JsonResponse;

/**
 * O relógio do agendador, em produção.
 *
 * Com o Cloud Run escalando a zero não há `schedule:work` sempre ligado: o
 * Cloud Scheduler chama esta rota a cada 15 minutos (infra/gcp.tf, onde está
 * o porquê). Publica o que venceu e leva a regeneração que ficou pendente
 * (ver SiteRebuild). Chama o `ScheduledPublisher` direto, nunca o comando:
 * ver o porquê lá.
 */
class TickController extends Controller
{
    public function __invoke(): JsonResponse
    {
        ScheduledPublisher::run();

        return response()->json(['rebuilt' => SiteRebuild::flush()]);
    }
}
