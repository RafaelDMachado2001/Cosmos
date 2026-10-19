<?php

declare(strict_types=1);

namespace App\Modules\Identity\Models;

use Database\Factories\MemberFactory;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Support\Carbon;

/**
 * Um leitor com conta, autenticado pelo guard `member`.
 *
 * Nunca é o admin: o guard `web` lê `users`, este lê `members`, e cada um
 * guarda a sessão sob a própria chave. Sem senha e sem "lembrar de mim": a
 * única entrada é o login social.
 *
 * @property int $id
 * @property string $name
 * @property string $handle
 * @property string|null $avatar_url
 * @property string|null $email
 * @property Carbon|null $email_verified_at
 * @property string $locale
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property Carbon|null $deleted_at
 */
#[UseFactory(MemberFactory::class)]
class Member extends Authenticatable
{
    /** @use HasFactory<MemberFactory> */
    use HasFactory, SoftDeletes;

    protected $fillable = ['name', 'handle', 'avatar_url', 'email', 'email_verified_at', 'locale'];

    protected $hidden = ['email'];

    /** Sem coluna: o SessionGuard não tenta girar um token que não existe. */
    protected $rememberTokenName = '';

    /**
     * @return HasMany<MemberIdentity, $this>
     */
    public function identities(): HasMany
    {
        return $this->hasMany(MemberIdentity::class);
    }

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
        ];
    }
}
