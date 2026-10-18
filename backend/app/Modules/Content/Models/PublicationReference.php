<?php

declare(strict_types=1);

namespace App\Modules\Content\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $publication_id
 * @property int $position
 * @property string $title
 * @property string $url
 * @property-read Publication $publication
 */
class PublicationReference extends Model
{
    protected $fillable = ['publication_id', 'position', 'title', 'url'];

    /** @return BelongsTo<Publication, $this> */
    public function publication(): BelongsTo
    {
        return $this->belongsTo(Publication::class);
    }
}
