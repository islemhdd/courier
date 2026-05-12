<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AssignServiceChefRequest;
use App\Http\Requests\Admin\AssignStructureChefRequest;
use App\Models\Service;
use App\Models\Structure;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AdminChefAffectationController extends Controller
{
    public function assignStructureChef(AssignStructureChefRequest $request, Structure $structure): JsonResponse
    {
        $data = $request->validated();
        $selectedUser = User::findOrFail($data['user_id']);

        if ($selectedUser->estAdmin()) {
            return $this->unprocessable(
                'Un administrateur ne peut pas être désigné comme chef de structure avec le modèle de rôles actuel. Les administrateurs conservent déjà un accès global.'
            );
        }

        if (!$selectedUser->actif) {
            return $this->unprocessable('L\'utilisateur selectionne est inactif.');
        }

        try {
            $payload = DB::transaction(function () use ($structure, $selectedUser) {
                $lockedStructure = Structure::query()
                    ->whereKey($structure->id)
                    ->lockForUpdate()
                    ->firstOrFail();

                $newChef = User::query()
                    ->whereKey($selectedUser->id)
                    ->lockForUpdate()
                    ->firstOrFail();

                $this->replaceStructureChef($lockedStructure, $newChef);

                $freshStructure = $lockedStructure->fresh(['chef']);
                $freshChef = $newChef->fresh(['structure', 'service']);

                return [
                    'structure' => $this->serializeStructure($freshStructure),
                    'chef' => $this->serializeUser($freshChef),
                ];
            }, 5);

            Log::info('Chef de structure affecte', [
                'actor_id' => $request->user()->id,
                'structure_id' => $structure->id,
                'new_chef_id' => $selectedUser->id,
            ]);

            return response()->json([
                'message' => 'Chef de structure affecté avec succès.',
                'data' => $payload,
                'structure' => $payload['structure'],
                'chef' => $payload['chef'],
            ]);
        } catch (\Throwable $e) {
            Log::error('Erreur affectation chef structure', [
                'error' => $e->getMessage(),
                'structure_id' => $structure->id,
                'user_id' => $selectedUser->id,
            ]);

            return response()->json([
                'message' => 'Une erreur est survenue lors de l\'affectation du chef de structure.',
                'error' => 'Une erreur est survenue lors de l\'affectation du chef de structure.',
                'data' => null,
            ], 500);
        }
    }

    public function assignServiceChef(AssignServiceChefRequest $request, Service $service): JsonResponse
    {
        $data = $request->validated();
        $selectedUser = User::findOrFail($data['user_id']);

        if ($selectedUser->estAdmin()) {
            return $this->unprocessable(
                'Un administrateur ne peut pas être désigné comme chef de service avec le modèle de rôles actuel. Les administrateurs conservent déjà un accès global.'
            );
        }

        if (!$selectedUser->actif) {
            return $this->unprocessable('L\'utilisateur selectionne est inactif.');
        }

        if (!$service->structure_id) {
            return $this->unprocessable('Ce service n\'est rattache a aucune structure. Veuillez d\'abord lui attribuer une structure.');
        }

        try {
            $payload = DB::transaction(function () use ($service, $selectedUser) {
                $lockedService = Service::query()
                    ->whereKey($service->id)
                    ->lockForUpdate()
                    ->firstOrFail();

                $newChef = User::query()
                    ->whereKey($selectedUser->id)
                    ->lockForUpdate()
                    ->firstOrFail();

                $this->replaceServiceChef($lockedService, $newChef);

                $freshService = $lockedService->fresh(['structure', 'chef']);
                $freshChef = $newChef->fresh(['structure', 'service']);

                return [
                    'service' => $this->serializeService($freshService),
                    'chef' => $this->serializeUser($freshChef),
                ];
            }, 5);

            Log::info('Chef de service affecte', [
                'actor_id' => $request->user()->id,
                'service_id' => $service->id,
                'new_chef_id' => $selectedUser->id,
            ]);

            return response()->json([
                'message' => 'Chef de service affecté avec succès.',
                'data' => $payload,
                'service' => $payload['service'],
                'chef' => $payload['chef'],
            ]);
        } catch (\Throwable $e) {
            Log::error('Erreur affectation chef service', [
                'error' => $e->getMessage(),
                'service_id' => $service->id,
                'user_id' => $selectedUser->id,
            ]);

            return response()->json([
                'message' => 'Une erreur est survenue lors de l\'affectation du chef de service.',
                'error' => 'Une erreur est survenue lors de l\'affectation du chef de service.',
                'data' => null,
            ], 500);
        }
    }

    private function replaceStructureChef(Structure $structure, User $newChef): void
    {
        $currentChefs = User::query()
            ->where('role', User::ROLE_CHEF)
            ->where('role_scope', User::SCOPE_STRUCTURE)
            ->where('structure_id', $structure->id)
            ->whereKeyNot($newChef->id)
            ->lockForUpdate()
            ->get();

        foreach ($currentChefs as $currentChef) {
            $this->removeStructureChefAffectation($currentChef, $structure);
        }

        Structure::query()
            ->where('chef_structure_id', $newChef->id)
            ->whereKeyNot($structure->id)
            ->update(['chef_structure_id' => null]);

        $newChef->update([
            'role' => User::ROLE_CHEF,
            'role_scope' => User::SCOPE_STRUCTURE,
            'structure_id' => $structure->id,
            'service_id' => null,
        ]);

        $structure->forceFill([
            'chef_structure_id' => $newChef->id,
        ])->save();
    }

    private function replaceServiceChef(Service $service, User $newChef): void
    {
        $currentChefs = User::query()
            ->where('role', User::ROLE_CHEF)
            ->where('role_scope', User::SCOPE_SERVICE)
            ->where('service_id', $service->id)
            ->whereKeyNot($newChef->id)
            ->lockForUpdate()
            ->get();

        foreach ($currentChefs as $currentChef) {
            $this->removeServiceChefAffectation($currentChef, $service);
        }

        Structure::query()
            ->where('chef_structure_id', $newChef->id)
            ->update(['chef_structure_id' => null]);

        $newChef->update([
            'role' => User::ROLE_CHEF,
            'role_scope' => User::SCOPE_SERVICE,
            'structure_id' => $service->structure_id,
            'service_id' => $service->id,
        ]);
    }

    private function removeStructureChefAffectation(User $currentChef, Structure $structure): void
    {
        if ($currentChef->estAdmin() || $currentChef->estChefGeneral()) {
            $currentChef->update([
                'structure_id' => null,
                'service_id' => null,
            ]);

            return;
        }

        $currentChef->update([
            'role' => User::ROLE_SECRETAIRE,
            'role_scope' => User::SCOPE_STRUCTURE,
            'structure_id' => $structure->id,
            'service_id' => null,
        ]);
    }

    private function removeServiceChefAffectation(User $currentChef, Service $service): void
    {
        if ($currentChef->estAdmin() || $currentChef->estChefGeneral()) {
            $currentChef->update([
                'structure_id' => null,
                'service_id' => null,
            ]);

            return;
        }

        $currentChef->update([
            'role' => User::ROLE_SECRETAIRE,
            'role_scope' => User::SCOPE_SERVICE,
            'structure_id' => $service->structure_id,
            'service_id' => $service->id,
        ]);
    }

    private function unprocessable(string $message): JsonResponse
    {
        return response()->json([
            'message' => $message,
            'error' => $message,
            'data' => null,
        ], 422);
    }

    private function serializeStructure(Structure $structure): array
    {
        return [
            'id' => $structure->id,
            'nom' => $structure->libelle,
            'libelle' => $structure->libelle,
            'description' => $structure->description,
            'chef' => $this->serializeUser($structure->chef),
            'chef_actuel' => $this->serializeUser($structure->chef),
        ];
    }

    private function serializeService(Service $service): array
    {
        return [
            'id' => $service->id,
            'nom' => $service->libelle,
            'libelle' => $service->libelle,
            'description' => $service->description,
            'structure_id' => $service->structure_id,
            'structure' => $service->structure ? [
                'id' => $service->structure->id,
                'libelle' => $service->structure->libelle,
            ] : null,
            'chef' => $this->serializeUser($service->chef),
            'chef_actuel' => $this->serializeUser($service->chef),
        ];
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
