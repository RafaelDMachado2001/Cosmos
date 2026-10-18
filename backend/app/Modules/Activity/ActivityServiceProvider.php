<?php

declare(strict_types=1);

namespace App\Modules\Activity;

use App\Modules\Activity\Listeners\AnonymizeActivities;
use App\Modules\Activity\Listeners\RecordMemberRegistered;
use App\Modules\Activity\PersonalData\ActivityPersonalData;
use App\Modules\Identity\Contracts\PersonalDataSource;
use App\Modules\Identity\Events\MemberDeleted;
use App\Modules\Identity\Events\MemberRegistered;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;

/**
 * O registro de atividades: escuta os eventos dos outros módulos e grava.
 *
 * Depende dos eventos e contratos de quem publica, nunca o contrário
 * (deptrac.yaml): o Identity não sabe que alguém o escuta.
 */
class ActivityServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Event::listen(MemberRegistered::class, RecordMemberRegistered::class);
        Event::listen(MemberDeleted::class, AnonymizeActivities::class);

        $this->app->tag(ActivityPersonalData::class, PersonalDataSource::TAG);
    }
}
