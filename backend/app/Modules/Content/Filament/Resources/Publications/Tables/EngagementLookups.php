<?php

declare(strict_types=1);

namespace App\Modules\Content\Filament\Resources\Publications\Tables;

use App\Modules\Content\Contracts\Engagement;
use App\Modules\Content\Contracts\PublicationEngagement;
use App\Modules\Content\Models\Publication;
use Filament\Tables\Contracts\HasTable;
use Illuminate\Support\Collection;
use WeakMap;

final class EngagementLookups
{
    /** @var WeakMap<object, self>|null */
    private static ?WeakMap $pages = null;

    /** @param array<int, Engagement> $engagement */
    private function __construct(private readonly array $engagement) {}

    public static function for(HasTable $livewire): self
    {
        $records = $livewire->getTableRecords();
        self::$pages ??= new WeakMap;

        return self::$pages[$records] ??= self::load($records instanceof Collection ? $records : collect($records->items()));
    }

    /** @param Collection<array-key, mixed> $publications */
    private static function load(Collection $publications): self
    {
        $ids = $publications
            ->filter(static fn (mixed $publication): bool => $publication instanceof Publication)
            ->map(static fn (Publication $publication): int => $publication->id)
            ->values()
            ->all();

        return new self(app(PublicationEngagement::class)->forPublications($ids));
    }

    public function of(int $publicationId): Engagement
    {
        return $this->engagement[$publicationId] ?? Engagement::none();
    }
}
