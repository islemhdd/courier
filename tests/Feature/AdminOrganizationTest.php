<?php

use App\Models\Service;
use App\Models\Structure;
use App\Models\User;

function createAdminOrganizationAdmin(): User
{
    return User::factory()->create([
        'role' => User::ROLE_ADMIN,
        'role_scope' => User::SCOPE_GENERAL,
        'structure_id' => null,
        'service_id' => null,
    ]);
}

test('only admin can access admin organization endpoints', function () {
    $secretary = User::factory()->create([
        'role' => User::ROLE_SECRETAIRE,
        'role_scope' => User::SCOPE_GENERAL,
    ]);

    $this->actingAs($secretary)
        ->getJson('/api/admin/structures')
        ->assertForbidden();
});

test('admin can replace structure chef without deleting old chef', function () {
    $admin = createAdminOrganizationAdmin();
    $structure = Structure::create(['libelle' => 'Direction generale']);

    $oldChef = User::factory()->create([
        'role' => User::ROLE_CHEF,
        'role_scope' => User::SCOPE_STRUCTURE,
        'structure_id' => $structure->id,
        'service_id' => null,
    ]);

    $newChef = User::factory()->create([
        'role' => User::ROLE_SECRETAIRE,
        'role_scope' => User::SCOPE_SERVICE,
        'structure_id' => null,
        'service_id' => null,
    ]);

    $structure->forceFill(['chef_structure_id' => $oldChef->id])->save();

    $this->actingAs($admin)
        ->patchJson("/api/admin/structures/{$structure->id}/chef", [
            'user_id' => $newChef->id,
        ])
        ->assertOk()
        ->assertJsonPath('chef.id', $newChef->id);

    $oldChef->refresh();
    $newChef->refresh();

    expect($oldChef->exists)->toBeTrue();
    expect($oldChef->role)->toBe(User::ROLE_SECRETAIRE);
    expect($oldChef->role_scope)->toBe(User::SCOPE_STRUCTURE);
    expect($oldChef->structure_id)->toBe($structure->id);
    expect($oldChef->service_id)->toBeNull();

    expect($newChef->role)->toBe(User::ROLE_CHEF);
    expect($newChef->role_scope)->toBe(User::SCOPE_STRUCTURE);
    expect($newChef->structure_id)->toBe($structure->id);
    expect($newChef->service_id)->toBeNull();

    expect(User::query()
        ->where('role', User::ROLE_CHEF)
        ->where('role_scope', User::SCOPE_STRUCTURE)
        ->where('structure_id', $structure->id)
        ->count())->toBe(1);

    expect($structure->fresh()->chef_structure_id)->toBe($newChef->id);
});

test('admin can replace service chef and keep old chef attached as secretary', function () {
    $admin = createAdminOrganizationAdmin();
    $structure = Structure::create(['libelle' => 'Direction technique']);
    $service = Service::create([
        'libelle' => 'Informatique',
        'structure_id' => $structure->id,
    ]);

    $oldChef = User::factory()->create([
        'role' => User::ROLE_CHEF,
        'role_scope' => User::SCOPE_SERVICE,
        'structure_id' => $structure->id,
        'service_id' => $service->id,
    ]);

    $newChef = User::factory()->create([
        'role' => User::ROLE_SECRETAIRE,
        'role_scope' => User::SCOPE_SERVICE,
        'structure_id' => null,
        'service_id' => null,
    ]);

    $this->actingAs($admin)
        ->patchJson("/api/admin/services/{$service->id}/chef", [
            'user_id' => $newChef->id,
        ])
        ->assertOk()
        ->assertJsonPath('chef.id', $newChef->id);

    $oldChef->refresh();
    $newChef->refresh();

    expect($oldChef->role)->toBe(User::ROLE_SECRETAIRE);
    expect($oldChef->role_scope)->toBe(User::SCOPE_SERVICE);
    expect($oldChef->structure_id)->toBe($structure->id);
    expect($oldChef->service_id)->toBe($service->id);

    expect($newChef->role)->toBe(User::ROLE_CHEF);
    expect($newChef->role_scope)->toBe(User::SCOPE_SERVICE);
    expect($newChef->structure_id)->toBe($structure->id);
    expect($newChef->service_id)->toBe($service->id);

    expect(User::query()
        ->where('role', User::ROLE_CHEF)
        ->where('role_scope', User::SCOPE_SERVICE)
        ->where('service_id', $service->id)
        ->count())->toBe(1);
});

test('assigning a chef already attached elsewhere moves the chef and clears stale structure pointer', function () {
    $admin = createAdminOrganizationAdmin();
    $sourceStructure = Structure::create(['libelle' => 'Ancienne structure']);
    $targetStructure = Structure::create(['libelle' => 'Nouvelle structure']);
    $targetService = Service::create([
        'libelle' => 'Courrier interne',
        'structure_id' => $targetStructure->id,
    ]);

    $chef = User::factory()->create([
        'role' => User::ROLE_CHEF,
        'role_scope' => User::SCOPE_STRUCTURE,
        'structure_id' => $sourceStructure->id,
        'service_id' => null,
    ]);

    $sourceStructure->forceFill(['chef_structure_id' => $chef->id])->save();

    $this->actingAs($admin)
        ->patchJson("/api/admin/services/{$targetService->id}/chef", [
            'user_id' => $chef->id,
        ])
        ->assertOk();

    $chef->refresh();

    expect($sourceStructure->fresh()->chef_structure_id)->toBeNull();
    expect($chef->role)->toBe(User::ROLE_CHEF);
    expect($chef->role_scope)->toBe(User::SCOPE_SERVICE);
    expect($chef->structure_id)->toBe($targetStructure->id);
    expect($chef->service_id)->toBe($targetService->id);
});

test('admin cannot delete structure while services remain attached', function () {
    $admin = createAdminOrganizationAdmin();
    $structure = Structure::create(['libelle' => 'Structure avec services']);
    Service::create([
        'libelle' => 'Service rattache',
        'structure_id' => $structure->id,
    ]);

    $this->actingAs($admin)
        ->deleteJson("/api/admin/structures/{$structure->id}")
        ->assertStatus(422)
        ->assertJsonPath('data.services_count', 1);
});

test('admin cannot assign an admin account as operational chef', function () {
    $admin = createAdminOrganizationAdmin();
    $structure = Structure::create(['libelle' => 'Secretariat general']);
    $targetAdmin = createAdminOrganizationAdmin();

    $this->actingAs($admin)
        ->patchJson("/api/admin/structures/{$structure->id}/chef", [
            'user_id' => $targetAdmin->id,
        ])
        ->assertStatus(422);

    expect($targetAdmin->fresh()->role)->toBe(User::ROLE_ADMIN);
});
