<?php

use App\Models\NiveauConfidentialite;
use App\Models\Service;
use App\Models\User;

function createServiceManagementContext(): array
{
    $niveau = NiveauConfidentialite::create([
        'libelle' => 'Interne',
        'rang' => 1,
    ]);

    $service = Service::create(['libelle' => 'Direction']);

    $admin = User::factory()->create([
        'role' => 'admin',
        'service_id' => $service->id,
        'niveau_confidentialite_id' => $niveau->id,
    ]);

    $chef = User::factory()->create([
        'role' => 'chef',
        'service_id' => $service->id,
        'niveau_confidentialite_id' => $niveau->id,
    ]);

    return [$admin, $chef, $service, $niveau];
}

test('chef cannot access services management endpoints', function () {
    [, $chef] = createServiceManagementContext();

    $this->actingAs($chef)
        ->getJson('/api/services')
        ->assertStatus(403);
});

test('admin can create and update service', function () {
    [$admin] = createServiceManagementContext();

    $response = $this->actingAs($admin)
        ->postJson('/api/services', [
            'libelle' => 'Ressources Humaines',
        ])
        ->assertCreated()
        ->assertJsonPath('service.libelle', 'Ressources Humaines');

    $serviceId = $response->json('service.id');

    $this->actingAs($admin)
        ->patchJson("/api/services/{$serviceId}", [
            'libelle' => 'RH',
        ])
        ->assertOk()
        ->assertJsonPath('service.libelle', 'RH');
});

test('admin cannot delete service with users attached', function () {
    [$admin, , $service, $niveau] = createServiceManagementContext();

    User::factory()->create([
        'role' => 'secretaire',
        'service_id' => $service->id,
        'niveau_confidentialite_id' => $niveau->id,
    ]);

    $this->actingAs($admin)
        ->deleteJson("/api/services/{$service->id}")
        ->assertStatus(422);
});

test('admin can delete empty service', function () {
    [$admin] = createServiceManagementContext();

    $service = Service::create(['libelle' => 'Archives']);

    $this->actingAs($admin)
        ->deleteJson("/api/services/{$service->id}")
        ->assertOk();

    $this->assertDatabaseMissing('services', [
        'id' => $service->id,
    ]);
});
