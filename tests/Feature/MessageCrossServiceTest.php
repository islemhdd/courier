<?php

use App\Models\Courrier;
use App\Models\Message;
use App\Models\NiveauConfidentialite;
use App\Models\Service;
use App\Models\Structure;
use App\Models\User;

function createCrossServiceFixtures(): array
{
    $niveauPublic = NiveauConfidentialite::create(['libelle' => 'Public', 'rang' => 0]);
    $niveauConfidentiel = NiveauConfidentialite::create(['libelle' => 'Confidentiel', 'rang' => 5]);
    $niveauSecret = NiveauConfidentialite::create(['libelle' => 'Secret', 'rang' => 10]);

    $structureA = Structure::create(['libelle' => 'Direction Generale']);
    $structureB = Structure::create(['libelle' => 'Direction RH']);

    $serviceA = Service::create(['libelle' => 'Service Comptabilite', 'structure_id' => $structureA->id]);
    $serviceB = Service::create(['libelle' => 'Service Paie', 'structure_id' => $structureA->id]);
    $serviceC = Service::create(['libelle' => 'Service Recrutement', 'structure_id' => $structureB->id]);

    $userA = User::factory()->create([
        'role' => 'secretaire',
        'role_scope' => 'service',
        'service_id' => $serviceA->id,
        'structure_id' => $structureA->id,
        'niveau_confidentialite_id' => $niveauConfidentiel->id,
    ]);

    $userB = User::factory()->create([
        'role' => 'secretaire',
        'role_scope' => 'service',
        'service_id' => $serviceB->id,
        'structure_id' => $structureA->id,
        'niveau_confidentialite_id' => $niveauConfidentiel->id,
    ]);

    $userC = User::factory()->create([
        'role' => 'chef',
        'role_scope' => 'service',
        'service_id' => $serviceC->id,
        'structure_id' => $structureB->id,
        'niveau_confidentialite_id' => $niveauPublic->id,
    ]);

    $admin = User::factory()->create([
        'role' => 'admin',
        'role_scope' => 'general',
        'service_id' => null,
        'structure_id' => null,
        'niveau_confidentialite_id' => $niveauSecret->id,
    ]);

    return [$userA, $userB, $userC, $admin, $niveauPublic, $niveauConfidentiel, $niveauSecret, $serviceA, $serviceB, $serviceC, $structureA, $structureB];
}

// ========== CAS AUTORISES ==========

test('user A (service A) can send message to user B (service B, same structure) without courrier', function () {
    [$userA, $userB] = createCrossServiceFixtures();

    $this->actingAs($userA)
        ->postJson('/api/messages', [
            'destinataire_id' => $userB->id,
            'contenu' => 'Message inter-service meme structure',
        ])
        ->assertCreated()
        ->assertJsonPath('data.contenu', 'Message inter-service meme structure');
});

test('user A (service A structure A) can send message to user C (service C structure B) without courrier', function () {
    [$userA, , $userC] = createCrossServiceFixtures();

    $this->actingAs($userA)
        ->postJson('/api/messages', [
            'destinataire_id' => $userC->id,
            'contenu' => 'Message cross-structure',
        ])
        ->assertCreated()
        ->assertJsonPath('data.contenu', 'Message cross-structure');
});

test('admin can send message to any user without courrier', function () {
    [, , $userC, $admin] = createCrossServiceFixtures();

    $this->actingAs($admin)
        ->postJson('/api/messages', [
            'destinataire_id' => $userC->id,
            'contenu' => 'Admin message to anyone',
        ])
        ->assertCreated();
});

test('user can send message with courrier reference when both sender and recipient can see it', function () {
    [$userA, $userB, , $admin, $niveauPublic] = createCrossServiceFixtures();

    $courrier = Courrier::create([
        'numero' => 'COUR-VISIBLE-001',
        'objet' => 'Courrier visible par tous',
        'type' => 'sortant',
        'statut' => 'VALIDE',
        'date_creation' => now(),
        'date_reception' => now(),
        'expediteur' => 'Service A',
        'destinataire' => 'Service B',
        'createur_id' => $admin->id,
        'niveau_confidentialite_id' => $niveauPublic->id,
        'service_source_id' => $userA->service_id,
    ]);

    // Add both users as recipients so they can see it
    $courrier->recipients()->create(['recipient_type' => 'user', 'user_id' => $userA->id]);
    $courrier->recipients()->create(['recipient_type' => 'user', 'user_id' => $userB->id]);

    $this->actingAs($userA)
        ->postJson('/api/messages', [
            'destinataire_id' => $userB->id,
            'contenu' => 'Ref to visible courrier',
            'courrier_id' => $courrier->id,
        ])
        ->assertCreated();
});

test('draft message is visible only by its sender', function () {
    [$userA, $userB] = createCrossServiceFixtures();

    $response = $this->actingAs($userA)
        ->postJson('/api/messages', [
            'destinataire_id' => $userB->id,
            'contenu' => 'Brouillon secret',
            'envoyer' => false,
        ])
        ->assertCreated();

    $messageId = $response->json('data.id');

    // User A (sender) can see the draft
    $this->actingAs($userA)
        ->getJson('/api/messages?type=brouillon')
        ->assertJsonFragment(['id' => $messageId]);

    // User B (recipient) cannot see the draft
    $this->actingAs($userB)
        ->getJson('/api/messages?type=brouillon')
        ->assertJsonMissing(['id' => $messageId]);
});

test('received message is visible by the recipient', function () {
    [$userA, $userB] = createCrossServiceFixtures();

    $message = Message::create([
        'contenu' => 'Message a lire',
        'date_envoi' => now(),
        'lu' => false,
        'statut' => Message::STATUT_ENVOYE,
        'emetteur_id' => $userA->id,
        'destinataire_id' => $userB->id,
    ]);

    $this->actingAs($userB)
        ->getJson('/api/messages?type=recu')
        ->assertJsonFragment(['id' => $message->id]);
});

test('sent message is visible by the sender', function () {
    [$userA, $userB] = createCrossServiceFixtures();

    $message = Message::create([
        'contenu' => 'Message envoye',
        'date_envoi' => now(),
        'lu' => false,
        'statut' => Message::STATUT_ENVOYE,
        'emetteur_id' => $userA->id,
        'destinataire_id' => $userB->id,
    ]);

    $this->actingAs($userA)
        ->getJson('/api/messages?type=envoye')
        ->assertJsonFragment(['id' => $message->id]);
});

test('destinataires endpoint returns all users from all services and structures', function () {
    [$userA, $userB, $userC, $admin] = createCrossServiceFixtures();

    $response = $this->actingAs($userA)
        ->getJson('/api/messages/destinataires?q=')
        ->assertOk();

    $ids = collect($response->json('utilisateurs'))->pluck('id')->all();

    // Should NOT contain self
    expect($ids)->not->toContain($userA->id);

    // Should contain users from other services/structures
    expect($ids)->toContain($userB->id);
    expect($ids)->toContain($userC->id);
    expect($ids)->toContain($admin->id);
});

// ========== CAS REFUSES ==========

test('auto-sending is forbidden', function () {
    [$userA] = createCrossServiceFixtures();

    $this->actingAs($userA)
        ->postJson('/api/messages', [
            'destinataire_id' => $userA->id,
            'contenu' => 'Message a soi-meme',
        ])
        ->assertStatus(422);
});

test('message with courrier is forbidden if sender cannot see the courrier', function () {
    [$userA, $userB, , $admin, , $niveauConfidentiel] = createCrossServiceFixtures();

    // Create a courrier visible only by admin (userA is not admin)
    $courrier = Courrier::create([
        'numero' => 'COUR-SECRET-002',
        'objet' => 'Courrier prive admin',
        'type' => 'sortant',
        'statut' => 'VALIDE',
        'date_creation' => now(),
        'date_reception' => now(),
        'expediteur' => 'Admin',
        'destinataire' => 'Admin',
        'createur_id' => $admin->id,
        'service_source_id' => null,
        'niveau_confidentialite_id' => $niveauConfidentiel->id,
    ]);

    // Only admin is recipient, userA cannot see it
    $courrier->recipients()->create(['recipient_type' => 'user', 'user_id' => $admin->id]);

    $this->actingAs($userA)
        ->postJson('/api/messages', [
            'destinataire_id' => $userB->id,
            'contenu' => 'Ref to invisible',
            'courrier_id' => $courrier->id,
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors('courrier_id');
});

test('message with courrier is forbidden if recipient cannot see the courrier', function () {
    [$userA, , $userC, $admin, $niveauPublic] = createCrossServiceFixtures();

    // Create a courrier visible by userA and admin, but NOT by userC
    $courrier = Courrier::create([
        'numero' => 'COUR-RESTREINT-003',
        'objet' => 'Courrier restreint',
        'type' => 'sortant',
        'statut' => 'VALIDE',
        'date_creation' => now(),
        'date_reception' => now(),
        'expediteur' => 'Service A',
        'destinataire' => 'Admin',
        'createur_id' => $admin->id,
        'service_source_id' => $userA->service_id,
        'niveau_confidentialite_id' => $niveauPublic->id,
    ]);

    // Only userA (same service source) and admin can see it
    // userC is in a different structure entirely

    $this->actingAs($userA)
        ->postJson('/api/messages', [
            'destinataire_id' => $userC->id,
            'contenu' => 'Ref to invisible for recipient',
            'courrier_id' => $courrier->id,
        ])
        ->assertStatus(422)
        ->assertJsonFragment(['Le destinataire n\'a pas l\'autorisation de consulter le courrier référencé.']);
});

test('message with courrier is forbidden if recipient confidentiality level is too low', function () {
    [$userA, , $userC, $admin, , , $niveauSecret] = createCrossServiceFixtures();

    // Create a courrier with Secret level
    $courrier = Courrier::create([
        'numero' => 'COUR-SECRET-004',
        'objet' => 'Top secret',
        'type' => 'sortant',
        'statut' => 'VALIDE',
        'date_creation' => now(),
        'date_reception' => now(),
        'expediteur' => 'Direction',
        'destinataire' => 'Limite',
        'createur_id' => $admin->id,
        'niveau_confidentialite_id' => $niveauSecret->id,
    ]);

    // Make userC a recipient
    $courrier->recipients()->create(['recipient_type' => 'user', 'user_id' => $userC->id]);

    // userC has niveauPublic (rang=0) but courrier is Secret (rang=10)
    $this->actingAs($admin)
        ->postJson('/api/messages', [
            'destinataire_id' => $userC->id,
            'contenu' => 'Secret message ref',
            'courrier_id' => $courrier->id,
        ])
        ->assertStatus(422)
        ->assertJsonFragment(['Le destinataire n\'a pas l\'autorisation de consulter le courrier référencé.']);
});

test('modifying a sent message is forbidden', function () {
    [$userA, $userB] = createCrossServiceFixtures();

    $message = Message::create([
        'contenu' => 'Sent message',
        'date_envoi' => now(),
        'lu' => false,
        'statut' => Message::STATUT_ENVOYE,
        'emetteur_id' => $userA->id,
        'destinataire_id' => $userB->id,
    ]);

    $this->actingAs($userA)
        ->patchJson("/api/messages/{$message->id}", [
            'contenu' => 'Modified after send',
        ])
        ->assertStatus(422)
        ->assertJsonPath('error', 'Impossible de modifier un message déjà envoyé.');
});

test('deleting a sent message is forbidden', function () {
    [$userA, $userB] = createCrossServiceFixtures();

    $message = Message::create([
        'contenu' => 'Sent to delete',
        'date_envoi' => now(),
        'lu' => false,
        'statut' => Message::STATUT_ENVOYE,
        'emetteur_id' => $userA->id,
        'destinataire_id' => $userB->id,
    ]);

    $this->actingAs($userA)
        ->deleteJson("/api/messages/{$message->id}")
        ->assertStatus(422)
        ->assertJsonPath('error', 'Impossible de supprimer un message déjà envoyé.');
});

// ========== VISIBILITE DES COURRIERS DANS LES MESSAGES ==========

test('message list hides courrier details if user has no access', function () {
    [$userA, $userB, , $admin, $niveauPublic] = createCrossServiceFixtures();

    $courrier = Courrier::create([
        'numero' => 'COUR-HIDDEN-005',
        'objet' => 'Courrier qui disparait',
        'type' => 'sortant',
        'statut' => 'VALIDE',
        'date_creation' => now(),
        'date_reception' => now(),
        'expediteur' => 'Service A',
        'destinataire' => 'Service B',
        'createur_id' => $admin->id,
        'service_source_id' => $userA->service_id,
        'niveau_confidentialite_id' => $niveauPublic->id,
    ]);

    // userA can see it (same service source), userB cannot by default
    $message = Message::create([
        'emetteur_id' => $userA->id,
        'destinataire_id' => $userB->id,
        'contenu' => 'Courrier ref',
        'courrier_id' => $courrier->id,
        'statut' => Message::STATUT_ENVOYE,
        'date_envoi' => now(),
    ]);

    // userB should see courrier_accessible = false
    $response = $this->actingAs($userB)
        ->getJson('/api/messages');

    $response->assertJsonFragment(['courrier_accessible' => false]);
    $response->assertJsonMissing(['numero' => $courrier->numero]);
});

test('message detail shows courrier accessible false for unauthorized user', function () {
    [$userA, $userB, , $admin, $niveauPublic] = createCrossServiceFixtures();

    $courrier = Courrier::create([
        'numero' => 'COUR-DETAIL-006',
        'objet' => 'Detail cache',
        'type' => 'sortant',
        'statut' => 'VALIDE',
        'date_creation' => now(),
        'date_reception' => now(),
        'expediteur' => 'Service A',
        'destinataire' => 'Admin',
        'createur_id' => $admin->id,
        'service_source_id' => $userA->service_id,
        'niveau_confidentialite_id' => $niveauPublic->id,
    ]);

    $message = Message::create([
        'emetteur_id' => $userA->id,
        'destinataire_id' => $userB->id,
        'contenu' => 'Detail test',
        'courrier_id' => $courrier->id,
        'statut' => Message::STATUT_ENVOYE,
        'date_envoi' => now(),
    ]);

    $this->actingAs($userB)
        ->getJson("/api/messages/{$message->id}")
        ->assertJsonFragment(['courrier_accessible' => false]);
});

// ========== MISE A JOUR DES BROUILLONS ==========

test('draft update with courrier reference validates recipient visibility', function () {
    [$userA, $userB, $userC, $admin, $niveauPublic] = createCrossServiceFixtures();

    // Create courrier visible by userA and userB, but not userC
    $courrier = Courrier::create([
        'numero' => 'COUR-DRAFT-007',
        'objet' => 'Courrier brouillon',
        'type' => 'sortant',
        'statut' => 'VALIDE',
        'date_creation' => now(),
        'date_reception' => now(),
        'expediteur' => 'Service A',
        'destinataire' => 'Service B',
        'createur_id' => $admin->id,
        'service_source_id' => $userA->service_id,
        'niveau_confidentialite_id' => $niveauPublic->id,
    ]);
    $courrier->recipients()->create(['recipient_type' => 'user', 'user_id' => $userB->id]);

    // Create draft from userA to userB
    $response = $this->actingAs($userA)
        ->postJson('/api/messages', [
            'destinataire_id' => $userB->id,
            'contenu' => 'Draft initial',
            'envoyer' => false,
        ])
        ->assertCreated();

    $messageId = $response->json('data.id');

    // Now userA tries to update draft with a courrier that userB can see -> should work
    $this->actingAs($userA)
        ->patchJson("/api/messages/{$messageId}", [
            'contenu' => 'Draft with visible courrier',
            'courrier_id' => $courrier->id,
        ])
        ->assertOk();

    // Now create a new draft to userC and try to reference a courrier userC cannot see
    $response2 = $this->actingAs($userA)
        ->postJson('/api/messages', [
            'destinataire_id' => $userC->id,
            'contenu' => 'Draft to userC',
            'envoyer' => false,
        ])
        ->assertCreated();

    $draftId = $response2->json('data.id');

    $this->actingAs($userA)
        ->patchJson("/api/messages/{$draftId}", [
            'contenu' => 'Draft with invisible courrier',
            'courrier_id' => $courrier->id,
        ])
        ->assertStatus(422)
        ->assertJsonFragment(['Le destinataire n\'a pas l\'autorisation de consulter le courrier référencé.']);
});

// ========== VISIBILITE DES MESSAGES ==========

test('third user cannot see message between two other users', function () {
    [$userA, $userB, $userC] = createCrossServiceFixtures();

    $message = Message::create([
        'emetteur_id' => $userA->id,
        'destinataire_id' => $userB->id,
        'contenu' => 'Prive',
        'statut' => Message::STATUT_ENVOYE,
        'date_envoi' => now(),
    ]);

    // userC should not be able to see this message
    $this->actingAs($userC)
        ->getJson("/api/messages/{$message->id}")
        ->assertStatus(403);

    // userC should not see it in list either
    $this->actingAs($userC)
        ->getJson('/api/messages?type=recu')
        ->assertJsonMissing(['id' => $message->id]);
});
