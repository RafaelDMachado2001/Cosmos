<?php

declare(strict_types=1);

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property string $slug
 * @property string $category
 * @property CarbonImmutable $published_at
 * @property bool $featured
 * @property string $status
 * @property-read Collection<int, PublicationTranslation> $translations
 */
class Publication extends Model
{
    /** Só publicações com este status chegam à API pública. */
    public const string STATUS_PUBLISHED = 'published';

    public const string STATUS_DRAFT = 'draft';

    /**
     * As quatro do handoff. A constelação colore a estrela por elas.
     *
     * Lidas de config/publications.php, gerado de src/core/types.ts por
     * `npm run emit:seed`: uma cópia escrita à mão divergiria no primeiro ajuste.
     *
     * @return list<string>
     */
    public static function categories(): array
    {
        return config('publications.categories');
    }

    protected $fillable = ['slug', 'category', 'published_at', 'featured', 'status'];

    protected function casts(): array
    {
        return [
            'published_at' => 'immutable_datetime',
            'featured' => 'boolean',
        ];
    }

    /** @return HasMany<PublicationTranslation, $this> */
    /** @return HasMany<PublicationTranslation, $this> */
    public function translations(): HasMany
    {
        return $this->hasMany(PublicationTranslation::class);
    }
}
