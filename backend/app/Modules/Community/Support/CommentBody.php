<?php

declare(strict_types=1);

namespace App\Modules\Community\Support;

final class CommentBody
{
    public static function normalize(string $body): string
    {
        return trim(str_replace(["\r\n", "\r"], "\n", $body));
    }

    public static function maxLength(): int
    {
        return (int) config('community.comment_max_length');
    }
}
