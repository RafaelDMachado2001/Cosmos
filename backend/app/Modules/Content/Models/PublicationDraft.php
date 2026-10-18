<?php

declare(strict_types=1);

namespace App\Modules\Content\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $publication_id
 * @property string $locale
 * @property string|null $title
 * @property string|null $subtitle
 * @property array<int, array<string, mixed>> $blocks
 * @property string|null $seo_title
 * @property string|null $seo_description
 * @property-read Publication $publication
 */
class PublicationDraft extends Model
{
    protected $fillable = [
        'publication_id',
        'locale',
        'title',
        'subtitle',
        'blocks',
        'seo_title',
        'seo_description',
    ];

    protected function casts(): array
    {
        return [
            'blocks' => 'array',
        ];
    }

    /** @return BelongsTo<Publication, $this> */
    public function publication(): BelongsTo
    {
        return $this->belongsTo(Publication::class);
    }
}
