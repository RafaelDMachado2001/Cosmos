<?php

namespace App\Modules\Content\Filament\Resources\Publications\Pages;

use App\Modules\Content\Filament\Resources\Publications\PublicationResource;
use Filament\Actions\Action;
use Filament\Resources\Pages\ListRecords;

class ListPublications extends ListRecords
{
    protected static string $resource = PublicationResource::class;

    protected function getHeaderActions(): array
    {
        return [
            // Criar também é no Studio (ver PublicationsTable).
            Action::make('studio')
                ->label('Nova publicação')
                ->url(fn (): string => route('rdm-studio')),
        ];
    }
}
