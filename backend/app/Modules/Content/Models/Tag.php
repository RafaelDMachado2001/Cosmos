<?php

declare(strict_types=1);

namespace App\Modules\Content\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * @property int $id
 * @property string $slug
 */
class Tag extends Model
{
    protected $fillable = ['slug'];

    /** @return BelongsToMany<Publication, $this> */
    public function publications(): BelongsToMany
    {
        return $this->belongsToMany(Publication::class);
    }
}
