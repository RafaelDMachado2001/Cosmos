<?php

declare(strict_types=1);

namespace App\Modules\Community\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $publication_id
 * @property int $member_id
 * @property CarbonImmutable $created_at
 */
class Reaction extends Model
{
    public $timestamps = false;

    public $incrementing = false;

    protected $primaryKey = null;

    protected $fillable = ['publication_id', 'member_id'];

    protected function casts(): array
    {
        return ['created_at' => 'immutable_datetime'];
    }
}
