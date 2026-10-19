<?php

namespace App\Modules\Content\Filament\Resources\Publications\Pages;

use App\Modules\Content\Filament\Resources\Publications\PublicationResource;
use Filament\Resources\Pages\CreateRecord;

class CreatePublication extends CreateRecord
{
    protected static string $resource = PublicationResource::class;
}
