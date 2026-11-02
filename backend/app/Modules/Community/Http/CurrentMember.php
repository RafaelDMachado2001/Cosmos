<?php

declare(strict_types=1);

namespace App\Modules\Community\Http;

use Illuminate\Http\Request;

final class CurrentMember
{
    public static function id(Request $request): int
    {
        $member = $request->user('sanctum');
        abort_if($member === null, 401);

        return (int) $member->getAuthIdentifier();
    }
}
