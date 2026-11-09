<?php

declare(strict_types=1);

namespace App\Modules\Identity\Support;

final class ReturnUrl
{
    public static function path(mixed $candidate): string
    {
        if (! is_string($candidate) || strlen($candidate) > 512) {
            return '/';
        }

        $valid = preg_match('#^/(?![/\\\\])[^\s\\\\]*$#', $candidate) === 1
            && parse_url($candidate, PHP_URL_HOST) === null;

        return $valid ? $candidate : '/';
    }

    public static function locale(string $path): string
    {
        return str_starts_with($path, '/en/') || $path === '/en' ? 'en' : 'pt';
    }

    public static function absolute(string $path, ?string $login = null): string
    {
        if ($login !== null) {
            $hash = strpos($path, '#');
            $fragment = $hash === false ? '' : substr($path, $hash);
            $path = $hash === false ? $path : substr($path, 0, $hash);
            $path .= (str_contains($path, '?') ? '&' : '?').'login='.$login.$fragment;
        }

        return rtrim((string) config('hosts.site'), '/').$path;
    }
}
