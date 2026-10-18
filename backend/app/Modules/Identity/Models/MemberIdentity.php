<?php

declare(strict_types=1);

namespace App\Modules\Identity\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Uma conta de provedor (Google, GitHub) ligada a um membro. O par
 * provedor + id do provedor é único: é por ele que o login acha a conta.
 *
 * @property int $id
 * @property int $member_id
 * @property string $provider
 * @property string $provider_user_id
 */
class MemberIdentity extends Model
{
    protected $fillable = ['provider', 'provider_user_id'];

    /**
     * @return BelongsTo<Member, $this>
     */
    public function member(): BelongsTo
    {
        return $this->belongsTo(Member::class);
    }
}
