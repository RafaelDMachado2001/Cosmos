<?php

use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Laravel\Sanctum\Http\Middleware\AuthenticateSession;

return [

    'stateful' => explode(',', (string) env('SANCTUM_STATEFUL_DOMAINS', implode(',', array_filter([
        'localhost',
        'localhost:5174',
        'localhost:8080',
        '127.0.0.1',
        '127.0.0.1:8080',
        parse_url((string) env('SITE_URL'), PHP_URL_HOST),
    ])))),

    'prefix' => 'api/sanctum',

    'guard' => ['member'],

    'expiration' => null,

    'token_prefix' => env('SANCTUM_TOKEN_PREFIX', ''),

    'middleware' => [
        'authenticate_session' => AuthenticateSession::class,
        'encrypt_cookies' => EncryptCookies::class,
        'validate_csrf_token' => ValidateCsrfToken::class,
    ],

];
