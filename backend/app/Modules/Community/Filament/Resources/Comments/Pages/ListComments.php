<?php

declare(strict_types=1);

namespace App\Modules\Community\Filament\Resources\Comments\Pages;

use App\Modules\Community\Filament\Resources\Comments\CommentResource;
use Filament\Resources\Pages\ListRecords;

class ListComments extends ListRecords
{
    protected static string $resource = CommentResource::class;
}
