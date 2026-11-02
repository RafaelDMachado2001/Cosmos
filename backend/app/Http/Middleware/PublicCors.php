<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class PublicCors
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        /** @var list<string> $credentialed */
        $credentialed = config('cors.paths', []);

        if ($request->is('api/*') && ! $request->is(...$credentialed)) {
            $response->headers->set('Access-Control-Allow-Origin', '*');
        }

        return $response;
    }
}
