<?php

namespace App\Modules\Content\Filament\Resources\Publications\Pages;

use App\Modules\Content\Filament\Resources\Publications\PublicationResource;
use App\Modules\Content\Models\Publication;
use App\Modules\Content\Support\PublicationLock;
use App\Modules\Content\Support\PublicationVersion;
use Filament\Actions\DeleteAction;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\EditRecord;
use Livewire\Attributes\Locked;

class EditPublication extends EditRecord
{
    protected static string $resource = PublicationResource::class;

    protected ?bool $hasDatabaseTransactions = true;

    #[Locked]
    public string $loadedVersion = '';

    protected function afterFill(): void
    {
        /** @var Publication $publication */
        $publication = $this->getRecord();
        $this->loadedVersion = PublicationVersion::etag($publication);
    }

    protected function beforeValidate(): void
    {
        $current = PublicationLock::acquire((int) $this->getRecord()->getKey());

        if ($current !== null && PublicationVersion::matches($current, $this->loadedVersion)) {
            return;
        }

        Notification::make()
            ->danger()
            ->title('A publicação mudou em outro lugar')
            ->body('Nada foi salvo. Recarregue a página para editar a versão atual.')
            ->send();

        $this->halt(true);
    }

    protected function afterSave(): void
    {
        $this->loadedVersion = PublicationVersion::etag(
            Publication::query()->findOrFail((int) $this->getRecord()->getKey()),
        );
    }

    protected function getHeaderActions(): array
    {
        return [
            DeleteAction::make(),
        ];
    }
}
