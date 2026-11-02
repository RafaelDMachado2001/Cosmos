<?php

declare(strict_types=1);

namespace App\Modules\Content\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property string $slug
 * @property string $category
 * @property CarbonImmutable $published_at
 * @property bool $featured
 * @property bool $indexable
 * @property array{nebula: float, motion: bool}|null $appearance
 * @property string $status
 * @property CarbonImmutable|null $content_published_at
 * @property-read Collection<int, PublicationTranslation> $translations
 * @property-read Collection<int, PublicationDraft> $drafts
 * @property-read Collection<int, Tag> $tags
 * @property-read Collection<int, PublicationReference> $references
 */
class Publication extends Model
{
    public const string STATUS_PUBLISHED = 'published';

    public const string STATUS_DRAFT = 'draft';

    public const string STATUS_SCHEDULED = 'scheduled';

    /**
     * @return list<string>
     */
    public static function categories(): array
    {
        return config('publications.categories');
    }

    protected $fillable = ['slug', 'category', 'published_at', 'featured', 'indexable', 'appearance', 'status'];

    protected function casts(): array
    {
        return [
            'published_at' => 'immutable_datetime',
            'content_published_at' => 'immutable_datetime',
            'featured' => 'boolean',
            'indexable' => 'boolean',
            'appearance' => 'array',
        ];
    }

    /** @return HasMany<PublicationTranslation, $this> */
    public function translations(): HasMany
    {
        return $this->hasMany(PublicationTranslation::class);
    }

    /**
     * @return HasMany<PublicationDraft, $this>
     */
    public function drafts(): HasMany
    {
        return $this->hasMany(PublicationDraft::class);
    }

    /** @return BelongsToMany<Tag, $this> */
    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(Tag::class);
    }

    /** @return HasMany<PublicationReference, $this> */
    public function references(): HasMany
    {
        return $this->hasMany(PublicationReference::class)->orderBy('position');
    }

    /** @param Builder<self> $query */
    #[Scope]
    protected function live(Builder $query): void
    {
        $query->where($query->qualifyColumn('status'), self::STATUS_PUBLISHED)
            ->where($query->qualifyColumn('published_at'), '<=', now());
    }
}
