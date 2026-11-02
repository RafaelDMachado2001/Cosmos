<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerifyEdge
{
    public function handle(Request $request, Closure $next): Response
    {
        $secret = config('hosts.edge_secret');

        if (is_string($secret) && $secret !== '' && ! $request->is('up')) {
            $given = $request->header('X-Edge-Secret');
            abort_unless(is_string($given) && hash_equals($secret, $given), 404);
        }

        return $next($request);
    }
}
