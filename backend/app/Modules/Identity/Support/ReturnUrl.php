<?php

declare(strict_types=1);

namespace App\Modules\Identity\Support;

/**
 * Para onde o login devolve o leitor: só um caminho do próprio site.
 *
 * Aceitar uma URL qualquer faria do callback um redirecionamento aberto —
 * um link legítimo do rdmlabs que termina num site de phishing. `//host` e
 * `/\host` são lidos pelo navegador como outro host, por isso também caem.
 */
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

    /** O idioma da conta nova sai do caminho de onde a pessoa veio. */
    public static function locale(string $path): string
    {
        return str_starts_with($path, '/en/') || $path === '/en' ? 'en' : 'pt';
    }

    /** O endereço completo no site (SITE_URL), ou o caminho no mesmo host. */
    public static function absolute(string $path, ?string $login = null): string
    {
        if ($login !== null) {
            $path .= (str_contains($path, '?') ? '&' : '?').'login='.$login;
        }

        return rtrim((string) config('hosts.site'), '/').$path;
    }
}
