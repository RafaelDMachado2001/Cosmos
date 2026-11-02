<?php

declare(strict_types=1);

namespace App\Modules\Content\Http\Controllers\Internal;

use App\Http\Controllers\Controller;
use App\Modules\Content\Support\ScheduledPublisher;
use App\Modules\Content\Support\SiteRebuild;
use Illuminate\Http\JsonResponse;

class TickController extends Controller
{
    public function __invoke(): JsonResponse
    {
        ScheduledPublisher::run();

        return response()->json(['rebuilt' => SiteRebuild::flush()]);
    }
}
