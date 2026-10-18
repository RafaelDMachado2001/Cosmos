<?php

declare(strict_types=1);

namespace App\Modules\Activity\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use LogicException;

/**
 * Uma ação de domínio de um leitor. Só se cria: o modelo recusa editar e
 * apagar, e o gatilho da migração recusa de novo no banco.
 *
 * @property int $id
 * @property int $member_id
 * @property string $verb
 * @property string|null $subject_type
 * @property int|null $subject_id
 * @property array<string, mixed> $payload
 * @property Carbon $occurred_at
 */
class Activity extends Model
{
    public $timestamps = false;

    protected $fillable = ['member_id', 'verb', 'subject_type', 'subject_id', 'payload', 'occurred_at'];

    /**
     * @param  array<string, mixed>  $payload
     */
    public static function record(int $memberId, string $verb, ?string $subjectType = null, ?int $subjectId = null, array $payload = []): self
    {
        return self::create([
            'member_id' => $memberId,
            'verb' => $verb,
            'subject_type' => $subjectType,
            'subject_id' => $subjectId,
            'payload' => $payload,
            'occurred_at' => now(),
        ]);
    }

    protected static function booted(): void
    {
        static::updating(static fn () => throw new LogicException('activities é append-only'));
        static::deleting(static fn () => throw new LogicException('activities é append-only'));
    }

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'occurred_at' => 'datetime',
        ];
    }
}
