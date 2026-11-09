<?php

declare(strict_types=1);

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property int $user_id
 * @property string $name
 * @property string $token_hash
 * @property CarbonImmutable $expires_at
 * @property CarbonImmutable|null $last_used_at
 * @property CarbonImmutable $created_at
 * @property-read User $user
 */
class StudioToken extends Model
{
    public const string PREFIX = 'rdms_';

    public const int MAX_DAYS = 365;

    protected $fillable = ['user_id', 'name', 'token_hash', 'expires_at', 'last_used_at'];

    protected $hidden = ['token_hash'];

    protected function casts(): array
    {
        return [
            'expires_at' => 'immutable_datetime',
            'last_used_at' => 'immutable_datetime',
            'created_at' => 'immutable_datetime',
            'updated_at' => 'immutable_datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return array{0: self, 1: string} */
    public static function issue(User $user, string $name, int $days): array
    {
        $plain = self::PREFIX.Str::random(48);

        $token = self::create([
            'user_id' => $user->id,
            'name' => $name,
            'token_hash' => self::hash($plain),
            'expires_at' => CarbonImmutable::now()->addDays(max(1, min($days, self::MAX_DAYS))),
        ]);

        return [$token, $plain];
    }

    public static function findValid(string $plain): ?self
    {
        if (! str_starts_with($plain, self::PREFIX)) {
            return null;
        }

        return self::query()
            ->with('user')
            ->where('token_hash', self::hash($plain))
            ->where('expires_at', '>', CarbonImmutable::now())
            ->first();
    }

    private static function hash(string $plain): string
    {
        return hash('sha256', $plain);
    }
}
