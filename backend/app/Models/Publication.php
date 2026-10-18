<?php

declare(strict_types=1);

namespace App\Models;

use Carbon\CarbonImmutable;
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
 * @property string $status
 * @property-read Collection<int, PublicationTranslation> $translations
 * @property-read Collection<int, PublicationDraft> $drafts
 * @property-read Collection<int, Tag> $tags
 * @property-read Collection<int, PublicationReference> $references
 */
class Publication extends Model
{
    /** Só publicações com este status chegam à API pública. */
    public const string STATUS_PUBLISHED = 'published';

    public const string STATUS_DRAFT = 'draft';

    /**
     * `published_at` continua a única data: nenhuma coluna nova guarda
     * "quando entra no ar" — o RDM Studio só expõe este status a mais para o
     * autor ver "agendada" em vez de calcular a toda hora se a data é futura.
     * `publications:publish-scheduled` transiciona para STATUS_PUBLISHED
     * quando a data chega.
     */
    public const string STATUS_SCHEDULED = 'scheduled';

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

    protected $fillable = ['slug', 'category', 'published_at', 'featured', 'indexable', 'status'];

    protected function casts(): array
    {
        return [
            'published_at' => 'immutable_datetime',
            'featured' => 'boolean',
            'indexable' => 'boolean',
        ];
    }

    /** @return HasMany<PublicationTranslation, $this> */
    public function translations(): HasMany
    {
        return $this->hasMany(PublicationTranslation::class);
    }

    /**
     * O conteúdo de trabalho do RDM Studio — nunca o que o público vê.
     *
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
}
