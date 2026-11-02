<?php

declare(strict_types=1);

namespace App\Modules\Content\Console\Commands;

use App\Modules\Content\Support\ScheduledPublisher;
use Illuminate\Console\Command;

class PublishScheduled extends Command
{
    protected $signature = 'publications:publish-scheduled';

    protected $description = 'Regenera o site quando uma publicação agendada vira elegível';

    public function handle(): int
    {
        ['transitioned' => $transitioned, 'previous' => $previous, 'eligible' => $eligible] = ScheduledPublisher::run();

        if ($transitioned > 0) {
            $this->info("{$transitioned} publicação(ões) agendada(s) passaram a publicada(s)");
        }

        if ($eligible > $previous) {
            $this->info("publicações agendadas: {$previous} -> {$eligible}, regeração disparada");
        }

        return self::SUCCESS;
    }
}
