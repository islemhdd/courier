<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreUserRequest;
use App\Http\Requests\UpdateUserRequest;
use App\Models\NiveauConfidentialite;
use App\Models\Service;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $actor = $request->user();

        if (!$actor || !$actor->can('viewAny', User::class)) {
            return response()->json([
                'error' => 'Vous n\'avez pas le droit de consulter les comptes utilisateurs.',
            ], 403);
        }

        $search = trim((string) $request->get('q', ''));

        $query = User::with(['service', 'niveauConfidentialite'])
            ->when(!$actor->estAdmin(), fn ($builder) => $builder->where('service_id', $actor->service_id))
            ->when($search !== '', function ($builder) use ($search) {
                $builder->where(function ($subQuery) use ($search) {
                    $subQuery->where('nom', 'like', '%' . $search . '%')
                        ->orWhere('prenom', 'like', '%' . $search . '%')
                        ->orWhere('email', 'like', '%' . $search . '%');
                });
            })
            ->orderBy('prenom')
            ->orderBy('nom');

        return response()->json([
            'utilisateurs' => $query->paginate(15)->through(
                fn (User $item) => $this->serializeUser($item, $actor)
            ),
            'meta' => [
                'roles' => User::ROLES,
                'services' => $this->servicesFor($actor),
                'niveaux_confidentialite' => NiveauConfidentialite::orderBy('rang')->get(['id', 'libelle', 'rang']),
                'peut_creer' => $actor->can('create', User::class),
            ],
        ]);
    }

    public function store(StoreUserRequest $request): JsonResponse
    {
        $actor = $request->user();
        $data = $request->validated();

        if (!$this->canAssignRoleAndService($actor, $data)) {
            return response()->json([
                'error' => 'Vous ne pouvez pas creer ce compte avec ce role ou ce service.',
            ], 403);
        }

        $created = User::create([
            'nom' => $data['nom'],
            'prenom' => $data['prenom'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'actif' => $data['actif'] ?? true,
            'role' => $data['role'],
            'service_id' => $data['service_id'] ?? null,
            'niveau_confidentialite_id' => $data['niveau_confidentialite_id'] ?? null,
        ]);

        return response()->json([
            'message' => 'Compte utilisateur cree avec succes.',
            'utilisateur' => $this->serializeUser($created->load(['service', 'niveauConfidentialite']), $actor),
        ], 201);
    }

    public function update(UpdateUserRequest $request, User $user): JsonResponse
    {
        $actor = $request->user();
        $data = $request->validated();

        if (!$this->canAssignRoleAndService($actor, $data, $user)) {
            return response()->json([
                'error' => 'Vous ne pouvez pas modifier ce compte avec ce role ou ce service.',
            ], 403);
        }

        if (array_key_exists('password', $data) && $data['password']) {
            $data['password'] = Hash::make($data['password']);
        } else {
            unset($data['password']);
        }

        $user->update($data);

        return response()->json([
            'message' => 'Compte utilisateur modifie avec succes.',
            'utilisateur' => $this->serializeUser($user->fresh(['service', 'niveauConfidentialite']), $actor),
        ]);
    }

    public function destroy(User $user, Request $request): JsonResponse
    {
        $actor = $request->user();

        if (!$actor || !$actor->can('delete', $user)) {
            return response()->json([
                'error' => 'Vous n\'avez pas le droit de supprimer ce compte utilisateur.',
            ], 403);
        }

        $user->delete();

        return response()->json([
            'message' => 'Compte utilisateur supprime avec succes.',
        ]);
    }

    private function serializeUser(User $item, User $actor): array
    {
        return [
            'id' => $item->id,
            'nom' => $item->nom,
            'prenom' => $item->prenom,
            'nom_complet' => $item->nom_complet,
            'email' => $item->email,
            'role' => $item->role,
            'actif' => $item->actif,
            'service_id' => $item->service_id,
            'service' => $item->service ? [
                'id' => $item->service->id,
                'libelle' => $item->service->libelle,
            ] : null,
            'niveau_confidentialite_id' => $item->niveau_confidentialite_id,
            'niveau_confidentialite' => $item->niveauConfidentialite ? [
                'id' => $item->niveauConfidentialite->id,
                'libelle' => $item->niveauConfidentialite->libelle,
                'rang' => $item->niveauConfidentialite->rang,
            ] : null,
            'peut_modifier' => $actor->can('update', $item),
            'peut_supprimer' => $actor->can('delete', $item),
        ];
    }

    private function servicesFor(User $actor)
    {
        return Service::query()
            ->when(!$actor->estAdmin(), fn ($builder) => $builder->where('id', $actor->service_id))
            ->orderBy('libelle')
            ->get(['id', 'libelle']);
    }

    private function canAssignRoleAndService(User $actor, array $data, ?User $target = null): bool
    {
        if ($actor->estAdmin()) {
            return true;
        }

        if (!$actor->peutGererUtilisateursDuService()) {
            return false;
        }

        $role = $data['role'] ?? $target?->role;
        $serviceId = $data['service_id'] ?? $target?->service_id;
           
        return $role !== User::ROLE_ADMIN && $serviceId === $actor->service_id;
    }
}
