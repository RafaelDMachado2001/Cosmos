<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Roda no serviço `scheduler` (docker-compose.yml), via `schedule:work`. É o
// que faz uma publicação agendada aparecer sem ninguém salvar nada no
// instante em que a data chega — ver PublishScheduled.
Schedule::command('publications:publish-scheduled')->everyMinute();
