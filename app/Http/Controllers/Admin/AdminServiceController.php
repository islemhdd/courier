<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreServiceRequest;
use App\Http\Requests\Admin\UpdateServiceRequest;
use App\Models\Service;
use App\Models\Structure;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminServiceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $search = trim((string) $request->get('q', ''));
        $perPage = max(1, min((int) $request->integer('per_page', 15), 500));

        $services = Service::query()
            ->with('structure')
            ->with('chef')
            ->withCount('users')
            ->when($search !== '', fn ($q) => $q->where('libelle', 'like', '%' . $search . '%'))
            ->orderBy('libelle')
            ->paginate($perPage)
            ->through(fn (Service $s) => $this->serialize($s));

        $meta = [
            'structures' => Structure::orderBy('libelle')->get(['id', 'libelle']),
            'all_users' => $this->usersForChefAssignment(),
        ];

        return response()->json([
            'message' => 'Services récupérés avec succès.',
            'data' => [
                'services' => $services,
                'meta' => $meta,
            ],
            'services' => $services,
            'meta' => $meta,
        ]);
    }

    public function store(StoreServiceRequest $request): JsonResponse
    {
        $service = Service::create($request->validated());
        $service->load('structure', 'chef')->loadCount('users');
        $data = $this->serialize($service);

        return response()->json([
            'message' => 'Service créé avec succès.',
            'data' => [
                'service' => $data,
                'chef' => $data['chef'],
                'structure' => $data['structure'],
            ],
            'service' => $data,
        ], 201);
    }

    public function update(UpdateServiceRequest $request, Service $service): JsonResponse
    {
        $service->update($request->validated());
        $data = $this->serialize($service->fresh()->load('structure')->loadCount('users')->load('chef'));

        return response()->json([
            'message' => 'Service modifié avec succès.',
            'data' => [
                'service' => $data,
                'chef' => $data['chef'],
                'structure' => $data['structure'],
            ],
            'service' => $data,
        ]);
    }

    public function destroy(Service $service): JsonResponse
    {
        $usage = $this->serviceUsage($service);

        if (array_sum($usage) > 0) {
            $message = $this->deleteBlockedMessage($usage);

            return response()->json([
                'message' => $message,
                'error' => $message,
                'data' => [
                    'usage' => $usage,
                ],
            ], 422);
        }

        $service->delete();

        return response()->json([
            'message' => 'Service supprimé avec succès.',
            'data' => null,
        ]);
    }

    private function serialize(Service $service): array
    {
        return [
            'id' => $service->id,
            'nom' => $service->libelle,
            'libelle' => $service->libelle,
            'description' => $service->description,
            'structure_id' => $service->structure_id,
            'structure' => $service->relationLoaded('structure') && $service->structure ? [
                'id' => $service->structure->id,
                'libelle' => $service->structure->libelle,
            ] : null,
            'users_count' => (int) ($service->users_count ?? $service->users()->count()),
            'chef' => $this->serializeUser($service->relationLoaded('chef') ? $service->chef : null),
            'chef_actuel' => $this->serializeUser($service->relationLoaded('chef') ? $service->chef : null),
        ];
    }

    private function serviceUsage(Service $service): array
    {
        return [
            'users' => $service->users()->count(),
            'courriers_source' => $service->courriersSource()->count(),
            'courriers_destinataires' => $service->courriersDestinataires()->count(),
            'courrier_recipients' => $service->courrierRecipients()->count(),
            'archives_source' => $service->archivesSource()->count(),
            'archives_destinataires' => $service->archivesDestinataires()->count(),
        ];
    }

    private function deleteBlockedMessage(array $usage): string
    {
        $reasons = [];

        if (($usage['users'] ?? 0) > 0) {
            $reasons[] = 'des utilisateurs y sont encore rattaches';
        }

        if (
            (($usage['courriers_source'] ?? 0) + ($usage['courriers_destinataires'] ?? 0) + ($usage['courrier_recipients'] ?? 0)) > 0
        ) {
            $reasons[] = 'des courriers y font encore reference';
        }

        if ((($usage['archives_source'] ?? 0) + ($usage['archives_destinataires'] ?? 0)) > 0) {
            $reasons[] = 'des archives y font encore reference';
        }

        return 'Impossible de supprimer ce service car ' . implode(' et ', $reasons) . '. Veuillez d\'abord réassigner ou traiter ces éléments.';
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
