<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (!$user || !$user->estAdmin()) {
            return response()->json([
                'error' => 'Acces refuse. Seul un administrateur peut effectuer cette action.',
            ], 403);
        }

        return $next($request);
    }
}
