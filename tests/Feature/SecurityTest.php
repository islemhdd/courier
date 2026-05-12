<?php

use App\Models\Courrier;
use App\Models\NiveauConfidentialite;
use App\Models\Service;
use App\Models\Structure;
use App\Models\User;

beforeEach(function () {
    Structure::create(['id' => 1, 'libelle' => 'Structure A']);
    Structure::create(['id' => 2, 'libelle' => 'Structure B']);
    Service::create(['id' => 1, 'libelle' => 'Service A1', 'structure_id' => 1]);
    Service::create(['id' => 2, 'libelle' => 'Service B1', 'structure_id' => 2]);
    NiveauConfidentialite::create(['id' => 1, 'libelle' => 'Normal', 'rang' => 1]);
    NiveauConfidentialite::create(['id' => 2, 'libelle' => 'Confidentiel', 'rang' => 2]);
});

// ============ CRITIQUE-1: Escalade de privilèges ============

test('chef de structure ne peut pas creer un chef general', function () {
    $user = User::factory()->create([
        'role' => 'chef',
        'role_scope' => 'structure',
        'structure_id' => 1,
        'service_id' => 1,
    ]);

    $this->actingAs($user)
        ->postJson('/api/utilisateurs', [
            'nom' => 'Hacker',
            'prenom' => 'Malveillant',
            'email' => 'hacker@test.test',
            'password' => 'password',
            'password_confirmation' => 'password',
            'role' => 'chef',
            'role_scope' => 'general',
            'structure_id' => 1,
            'service_id' => 1,
        ])
        ->assertStatus(403);
});

test('chef de structure ne peut pas creer un autre chef de structure', function () {
    $user = User::factory()->create([
        'role' => 'chef',
        'role_scope' => 'structure',
        'structure_id' => 1,
        'service_id' => 1,
    ]);

    $this->actingAs($user)
        ->postJson('/api/utilisateurs', [
            'nom' => 'Autre',
            'prenom' => 'Chef',
            'email' => 'autre.chef@test.test',
            'password' => 'password',
            'password_confirmation' => 'password',
            'role' => 'chef',
            'role_scope' => 'structure',
            'structure_id' => 1,
            'service_id' => 1,
        ])
        ->assertStatus(403);
});

test('chef de structure ne peut pas creer un secretaire de service', function () {
    $user = User::factory()->create([
        'role' => 'chef',
        'role_scope' => 'structure',
        'structure_id' => 1,
        'service_id' => 1,
    ]);

    $this->actingAs($user)
        ->postJson('/api/utilisateurs', [
            'nom' => 'Secretaire',
            'prenom' => 'Test',
            'email' => 'secretaire@test.test',
            'password' => 'password',
            'password_confirmation' => 'password',
            'role' => 'secretaire',
            'role_scope' => 'service',
            'structure_id' => 1,
            'service_id' => 1,
        ])
        ->assertStatus(403);
});

test('chef de service ne peut pas creer un utilisateur hors de son service', function () {
    $user = User::factory()->create([
        'role' => 'chef',
        'role_scope' => 'service',
        'structure_id' => 1,
        'service_id' => 1,
    ]);

    $this->actingAs($user)
        ->postJson('/api/utilisateurs', [
            'nom' => 'Autre',
            'prenom' => 'Service',
            'email' => 'autre.service@test.test',
            'password' => 'password',
            'password_confirmation' => 'password',
            'role' => 'secretaire',
            'role_scope' => 'service',
            'structure_id' => 1,
            'service_id' => 2,
        ])
        ->assertStatus(403);
});

// ============ ACCÈS NON AUTORISÉ ============

test('simple secretaire ne peut pas gerer les utilisateurs', function () {
    $user = User::factory()->create([
        'role' => 'secretaire',
        'role_scope' => 'service',
        'service_id' => 1,
    ]);

    $this->actingAs($user)
        ->getJson('/api/utilisateurs')
        ->assertStatus(403);
});

test('utilisateur non autorise ne peut pas acceder aux courriers', function () {
    $niveau = NiveauConfidentialite::find(2);
    $createur = User::factory()->create(['role' => 'admin']);

    $courrier = Courrier::create([
        'type' => 'entrant',
        'statut' => 'RECU',
        'niveau_confidentialite_id' => 2,
        'createur_id' => $createur->id,
        'objet' => 'Test',
        'resume' => 'Test',
        'expediteur' => 'Test Expediteur',
        'date_reception' => now(),
        'mode_diffusion' => 'unicast',
    ]);

    $user = User::factory()->create([
        'role' => 'secretaire',
        'role_scope' => 'service',
        'service_id' => 2,
        'structure_id' => 2,
        'niveau_confidentialite_id' => 1,
    ]);

    $this->actingAs($user)
        ->getJson("/api/courriers/{$courrier->id}")
        ->assertStatus(404);
});

// ============ IDOR PROTECTION ============

test('courrier inexistant retourne 404', function () {
    $user = User::factory()->create(['role' => 'admin']);

    $this->actingAs($user)
        ->getJson('/api/courriers/99999')
        ->assertStatus(404);
});

// ============ VALIDATION DES FICHIERS ============

test('upload de fichier avec type invalide est rejete', function () {
    $user = User::factory()->create(['role' => 'admin']);

    $fakeFile = Illuminate\Http\UploadedFile::fake()->create('malware.exe', 100);

    $this->actingAs($user)
        ->postJson('/api/courriers', [
            'objet' => 'Test',
            'resume' => 'Test',
            'type' => 'entrant',
            'date_reception' => now()->format('Y-m-d'),
            'niveau_confidentialite_id' => 1,
            'mode_diffusion' => 'unicast',
            'destinataire' => 'Test',
            'fichier' => $fakeFile,
        ])
        ->assertStatus(422);
});

test('upload de fichier trop volumineux est rejete', function () {
    $user = User::factory()->create(['role' => 'admin']);

    $fakeFile = Illuminate\Http\UploadedFile::fake()->create('document.pdf', 15000);

    $this->actingAs($user)
        ->postJson('/api/courriers', [
            'objet' => 'Test',
            'resume' => 'Test',
            'type' => 'entrant',
            'date_reception' => now()->format('Y-m-d'),
            'niveau_confidentialite_id' => 1,
            'mode_diffusion' => 'unicast',
            'destinataire' => 'Test',
            'fichier' => $fakeFile,
        ])
        ->assertStatus(422);
});

// ============ PERMISSIONS DE SUPPRESSION ============

test('seul un admin peut supprimer un courrier', function () {
    $createur = User::factory()->create(['role' => 'admin']);

    $courrier = Courrier::create([
        'type' => 'entrant',
        'statut' => 'RECU',
        'createur_id' => $createur->id,
        'objet' => 'Test',
        'resume' => 'Test',
        'expediteur' => 'Test Expediteur',
        'niveau_confidentialite_id' => 1,
        'date_reception' => now(),
        'mode_diffusion' => 'unicast',
    ]);

    $chef = User::factory()->create([
        'role' => 'chef',
        'role_scope' => 'general',
    ]);

    $this->actingAs($chef)
        ->deleteJson("/api/courriers/{$courrier->id}")
        ->assertStatus(403);
});

test('admin peut supprimer un courrier', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    $courrier = Courrier::create([
        'type' => 'entrant',
        'statut' => 'RECU',
        'createur_id' => $admin->id,
        'objet' => 'Test',
        'resume' => 'Test',
        'expediteur' => 'Test Expediteur',
        'niveau_confidentialite_id' => 1,
        'date_reception' => now(),
        'mode_diffusion' => 'unicast',
    ]);

    $this->actingAs($admin)
        ->deleteJson("/api/courriers/{$courrier->id}")
        ->assertOk();
});

// ============ NIVEAU DE CONFIDENTIALITÉ ============

test('un utilisateur ne peut pas creer un courrier avec un niveau superieur au sien', function () {
    $user = User::factory()->create([
        'role' => 'chef',
        'role_scope' => 'general',
        'niveau_confidentialite_id' => 1,
    ]);

    $this->actingAs($user)
        ->postJson('/api/courriers', [
            'objet' => 'Test',
            'resume' => 'Test',
            'type' => 'sortant',
            'date_reception' => now()->format('Y-m-d'),
            'niveau_confidentialite_id' => 2,
            'mode_diffusion' => 'unicast',
        ])
        ->assertStatus(422);
});

// ============ RATE LIMITING ============

test('tentatives de login excessives sont bloquees', function () {
    User::factory()->create([
        'email' => 'ratelimit@test.test',
    ]);

    for ($i = 0; $i < 5; $i++) {
        $this->withHeader('Origin', 'http://localhost:5173')
            ->postJson('/api/login', [
                'email' => 'ratelimit@test.test',
                'password' => 'wrong_password',
            ]);
    }

    $this->withHeader('Origin', 'http://localhost:5173')
        ->postJson('/api/login', [
            'email' => 'ratelimit@test.test',
            'password' => 'wrong_password',
        ])
        ->assertStatus(429);
});

// ============ MESSAGES ============

test('un utilisateur ne peut pas samenvoyer un message a lui-meme', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson('/api/messages', [
            'destinataire_id' => $user->id,
            'contenu' => 'Test',
        ])
        ->assertStatus(422);
});
