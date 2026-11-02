<?php

use App\Modules\Activity\ActivityServiceProvider;
use App\Modules\Community\CommunityServiceProvider;
use App\Modules\Content\ContentServiceProvider;
use App\Modules\Identity\IdentityServiceProvider;
use App\Providers\AppServiceProvider;
use App\Providers\Filament\AdminPanelProvider;

return [
    AppServiceProvider::class,
    ContentServiceProvider::class,
    IdentityServiceProvider::class,
    CommunityServiceProvider::class,
    ActivityServiceProvider::class,
    AdminPanelProvider::class,
];
