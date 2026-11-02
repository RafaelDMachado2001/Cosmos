<?php

declare(strict_types=1);

namespace App\Modules\Content\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $publication_id
 * @property string $locale
 * @property string $title
 * @property string $summary
 * @property string $body
 * @property string|null $seo_title
 * @property string|null $seo_description
 * @property-read Publication $publication
 */
class PublicationTranslation extends Model
{
    /**
     * @return list<string>
     */
    public static function locales(): array
    {
        return config('publications.locales');
    }

    protected $fillable = ['publication_id', 'locale', 'title', 'summary', 'body', 'seo_title', 'seo_description'];

    protected $guarded = ['search_vector'];

    /** @return BelongsTo<Publication, $this> */
    public function publication(): BelongsTo
    {
        return $this->belongsTo(Publication::class);
    }
}
