<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreStructureRequest;
use App\Http\Requests\Admin\UpdateStructureRequest;
use App\Models\Structure;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminStructureController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $search = trim((string) $request->get('q', ''));
        $perPage = max(1, min((int) $request->integer('per_page', 15), 500));

        $structures = Structure::query()
            ->withCount('services')
            ->withCount('users')
            ->with('chef')
            ->when($search !== '', fn ($q) => $q->where('libelle', 'like', '%' . $search . '%'))
            ->orderBy('libelle')
            ->paginate($perPage)
            ->through(fn (Structure $s) => $this->serialize($s));

        $meta = [
            'all_users' => $this->usersForChefAssignment(),
        ];

        return response()->json([
            'message' => 'Structures récupérées avec succès.',
            'data' => [
                'structures' => $structures,
                'meta' => $meta,
            ],
            'structures' => $structures,
            'meta' => $meta,
        ]);
    }

    public function store(StoreStructureRequest $request): JsonResponse
    {
        $structure = Structure::create($request->validated());
        $data = $this->serialize($structure->loadCount('services')->loadCount('users')->load('chef'));

        return response()->json([
            'message' => 'Structure créée avec succès.',
            'data' => [
                'structure' => $data,
                'chef' => $data['chef'],
            ],
            'structure' => $data,
        ], 201);
    }

    public function update(UpdateStructureRequest $request, Structure $structure): JsonResponse
    {
        $structure->update($request->validated());
        $data = $this->serialize($structure->fresh()->loadCount('services')->loadCount('users')->load('chef'));

        return response()->json([
            'message' => 'Structure modifiée avec succès.',
            'data' => [
                'structure' => $data,
                'chef' => $data['chef'],
            ],
            'structure' => $data,
        ]);
    }

    public function destroy(Structure $structure): JsonResponse
    {
        if ($structure->services()->exists()) {
            $message = 'Impossible de supprimer cette structure car elle contient encore des services. Veuillez d\'abord réassigner ou supprimer les services rattachés.';

            return response()->json([
                'message' => $message,
                'error' => $message,
                'data' => [
                    'services_count' => $structure->services()->count(),
                ],
            ], 422);
        }

        $structure->delete();

        return response()->json([
            'message' => 'Structure supprimée avec succès.',
            'data' => null,
        ]);
    }

    private function serialize(Structure $structure): array
    {
        return [
            'id' => $structure->id,
            'nom' => $structure->libelle,
            'libelle' => $structure->libelle,
            'description' => $structure->description,
            'services_count' => (int) ($structure->services_count ?? $structure->services()->count()),
            'users_count' => (int) ($structure->users_count ?? $structure->users()->count()),
            'chef' => $this->serializeUser($structure->relationLoaded('chef') ? $structure->chef : null),
            'chef_actuel' => $this->serializeUser($structure->relationLoaded('chef') ? $structure->chef : null),
        ];
    }

    private function usersForChefAssignment()
    {
        return User::query()
            ->where('role', '!=', User::ROLE_ADMIN)
            ->where('actif', true)
            ->orderBy('prenom')
            ->orderBy('nom')
            ->get(['id', 'nom', 'prenom', 'email', 'role', 'role_scope', 'structure_id', 'service_id', 'actif'])
            ->map(fn (User $user) => $this->serializeUser($user))
            ->values();
    }

    private function serializeUser(?User $user): ?array
    {
        if (!$user) {
            return null;
        }

        return [
            'id' => $user->id,
            'nom' => $user->nom,
            'prenom' => $user->prenom,
            'nom_complet' => $user->nom_complet,
            'email' => $user->email,
            'role' => $user->role,
            'role_scope' => $user->role_scope,
            'structure_id' => $user->structure_id,
            'service_id' => $user->service_id,
        ];
    }
}
