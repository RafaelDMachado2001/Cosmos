<?php

declare(strict_types=1);

namespace App\Modules\Community\Filament\Resources\Comments\Tables;

use App\Modules\Community\Models\Comment;
use App\Modules\Content\Contracts\PublicationSlugs;
use App\Modules\Identity\Contracts\PublicProfile;
use App\Modules\Identity\Contracts\PublicProfiles;
use Filament\Tables\Contracts\HasTable;
use Illuminate\Support\Collection;
use WeakMap;

final class CommentLookups
{
    /** @var WeakMap<object, self>|null */
    private static ?WeakMap $pages = null;

    /**
     * @param  array<int, PublicProfile>  $profiles
     * @param  array<int, string>  $slugs
     */
    private function __construct(
        private readonly array $profiles,
        private readonly array $slugs,
    ) {}

    public static function for(HasTable $livewire): self
    {
        $records = $livewire->getTableRecords();
        self::$pages ??= new WeakMap;

        return self::$pages[$records] ??= self::load($records instanceof Collection ? $records : collect($records->items()));
    }

    /** @param Collection<array-key, mixed> $comments */
    private static function load(Collection $comments): self
    {
        $comments = $comments->filter(static fn (mixed $comment): bool => $comment instanceof Comment);

        return new self(
            app(PublicProfiles::class)->forMembers($comments->pluck('member_id')->all()),
            app(PublicationSlugs::class)->forIds($comments->pluck('publication_id')->all()),
        );
    }

    public function author(int $memberId): string
    {
        $profile = $this->profiles[$memberId] ?? null;

        return $profile === null ? 'Conta removida' : '@'.$profile->handle;
    }

    public function publication(int $publicationId): string
    {
        return $this->slugs[$publicationId] ?? '—';
    }
}
