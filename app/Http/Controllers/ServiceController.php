<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreServiceRequest;
use App\Http\Requests\UpdateServiceRequest;
use App\Models\Service;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ServiceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $actor = $request->user();

        if (!$actor || !$actor->can('viewAny', Service::class)) {
            return response()->json([
                'error' => 'Vous n\'avez pas le droit de consulter les services.',
            ], 403);
        }

        $search = trim((string) $request->get('q', ''));

        $services = Service::query()
            ->when($search !== '', fn ($query) => $query->where('libelle', 'like', '%' . $search . '%'))
            ->withCount('users')
            ->orderBy('libelle')
            ->paginate(15)
            ->through(fn (Service $service) => $this->serializeService($service, $actor));

        return response()->json([
            'services' => $services,
            'meta' => [
                'peut_creer' => $actor->can('create', Service::class),
            ],
        ]);
    }

    public function store(StoreServiceRequest $request): JsonResponse
    {
        $service = Service::create($request->validated());
        $service->loadCount('users');

        return response()->json([
            'message' => 'Service cree avec succes.',
            'service' => $this->serializeService($service, $request->user()),
        ], 201);
    }

    public function update(UpdateServiceRequest $request, Service $service): JsonResponse
    {
        $service->update($request->validated());
        $service->loadCount('users');

        return response()->json([
            'message' => 'Service modifie avec succes.',
            'service' => $this->serializeService($service, $request->user()),
        ]);
    }

    public function destroy(Service $service, Request $request): JsonResponse
    {
        $actor = $request->user();

        if (!$actor || !$actor->can('delete', $service)) {
            return response()->json([
                'error' => 'Vous n\'avez pas le droit de supprimer ce service.',
            ], 403);
        }

        if ($service->users()->exists()) {
            return response()->json([
                'error' => 'Impossible de supprimer un service qui contient encore des utilisateurs.',
            ], 422);
        }

        $service->delete();

        return response()->json([
            'message' => 'Service supprime avec succes.',
        ]);
    }

    private function serializeService(Service $service, $actor): array
    {
        return [
            'id' => $service->id,
            'libelle' => $service->libelle,
            'users_count' => $service->users_count ?? 0,
            'peut_modifier' => $actor->can('update', $service),
            'peut_supprimer' => $actor->can('delete', $service),
        ];
    }
}
