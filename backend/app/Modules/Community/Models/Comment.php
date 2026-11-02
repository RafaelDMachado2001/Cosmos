<?php

declare(strict_types=1);

namespace App\Modules\Community\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property int $publication_id
 * @property int $member_id
 * @property string $locale
 * @property string|null $body
 * @property string $status
 * @property CarbonImmutable $created_at
 * @property CarbonImmutable $updated_at
 */
class Comment extends Model
{
    public const string STATUS_PUBLISHED = 'published';

    public const string STATUS_HIDDEN = 'hidden';

    public const string STATUS_DELETED = 'deleted';

    protected $fillable = ['publication_id', 'member_id', 'locale', 'body', 'status'];

    protected function casts(): array
    {
        return [
            'created_at' => 'immutable_datetime',
            'updated_at' => 'immutable_datetime',
        ];
    }

    /** @param Builder<self> $query */
    #[Scope]
    protected function visible(Builder $query): void
    {
        $query->where($query->qualifyColumn('status'), self::STATUS_PUBLISHED);
    }
}
