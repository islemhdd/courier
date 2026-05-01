<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AuthenticatedSessionController extends Controller
{
    public function store(LoginRequest $request): JsonResponse
    {
        $request->authenticate();
        $request->session()->regenerate();

        return response()->json([
            'message' => 'Authentification reussie.',
            'user' => $this->serializeUser($request->user()),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'user' => $this->serializeUser($request->user()),
        ]);
    }

    public function destroy(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();
        Auth::guard('sanctum')->forgetUser();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json([
            'message' => 'Session fermee.',
        ]);
    }

    private function serializeUser($user): array
    {
        $user->loadMissing(['service', 'niveauConfidentialite']);

        return [
            'id' => $user->id,
            'nom' => $user->nom,
            'prenom' => $user->prenom,
            'nom_complet' => $user->nom_complet,
            'email' => $user->email,
            'role' => $user->role,
            'actif' => $user->actif,
            'service' => $user->service ? [
                'id' => $user->service->id,
                'libelle' => $user->service->libelle,
            ] : null,
            'niveau_confidentialite' => $user->niveauConfidentialite ? [
                'id' => $user->niveauConfidentialite->id,
                'libelle' => $user->niveauConfidentialite->libelle,
                'rang' => $user->niveauConfidentialite->rang,
            ] : null,
            'permissions' => [
                'peut_creer_courrier' => $user->peutCreerCourrier(),
                'peut_valider_courriers' => $user->estChef() || $user->estAdmin(),
                'peut_gerer_utilisateurs' => $user->peutConsulterUtilisateurs(),
                'peut_gerer_tous_les_utilisateurs' => $user->peutGererTousLesUtilisateurs(),
                'peut_gerer_services' => $user->estAdmin(),
            ],
        ];
    }
}
