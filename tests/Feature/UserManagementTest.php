<?php

use App\Models\NiveauConfidentialite;
use App\Models\Service;
use App\Models\User;

function createUserManagementContext(): array
{
    $niveau = NiveauConfidentialite::create([
        'libelle' => 'Confidentiel',
        'rang' => 1,
    ]);

    $serviceA = Service::create(['libelle' => 'Direction']);
    $serviceB = Service::create(['libelle' => 'RH']);

    $admin = User::factory()->create([
        'role' => 'admin',
        'service_id' => $serviceA->id,
        'niveau_confidentialite_id' => $niveau->id,
    ]);

    $chef = User::factory()->create([
        'role' => 'chef',
        'service_id' => $serviceA->id,
        'niveau_confidentialite_id' => $niveau->id,
    ]);

    $secretaire = User::factory()->create([
        'role' => 'secretaire',
        'service_id' => $serviceA->id,
        'niveau_confidentialite_id' => $niveau->id,
    ]);

    $autreService = User::factory()->create([
        'role' => 'secretaire',
        'service_id' => $serviceB->id,
        'niveau_confidentialite_id' => $niveau->id,
    ]);

    return [$admin, $chef, $secretaire, $autreService, $niveau, $serviceA, $serviceB];
}

test('simple user cannot access user management endpoints', function () {
    [, , $secretaire] = createUserManagementContext();

    $this->actingAs($secretaire)
        ->getJson('/api/utilisateurs')
        ->assertStatus(403);
});

test('chef sees only users from own service', function () {
    [, $chef, $secretaire, $autreService] = createUserManagementContext();

    $response = $this->actingAs($chef)
        ->getJson('/api/utilisateurs')
        ->assertOk();

    $ids = collect($response->json('utilisateurs.data'))->pluck('id');

    expect($ids)->toContain($chef->id);
    expect($ids)->toContain($secretaire->id);
    expect($ids)->not->toContain($autreService->id);
});

test('chef cannot create admin or cross service user', function () {
    [, $chef, , , $niveau, , $serviceB] = createUserManagementContext();

    $this->actingAs($chef)
        ->postJson('/api/utilisateurs', [
            'nom' => 'Admin',
            'prenom' => 'Interdit',
            'email' => 'admin.interdit@example.test',
            'password' => 'password',
            'password_confirmation' => 'password',
            'role' => 'admin',
            'service_id' => $serviceB->id,
            'niveau_confidentialite_id' => $niveau->id,
        ])
        ->assertStatus(403);
});

test('admin can create user account', function () {
    [$admin, , , , $niveau, $serviceA] = createUserManagementContext();

    $this->actingAs($admin)
        ->postJson('/api/utilisateurs', [
            'nom' => 'Doe',
            'prenom' => 'Jane',
            'email' => 'jane.doe@example.test',
            'password' => 'password',
            'password_confirmation' => 'password',
            'role' => 'secretaire',
            'service_id' => $serviceA->id,
            'niveau_confidentialite_id' => $niveau->id,
        ])
        ->assertCreated()
        ->assertJsonPath('utilisateur.email', 'jane.doe@example.test');
});
