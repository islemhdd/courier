<?php

use App\Models\Courrier;
use App\Models\Message;
use App\Models\NiveauConfidentialite;
use App\Models\Service;
use App\Models\User;

function createMessageFixtures(): array
{
    $niveau = NiveauConfidentialite::create([
        'libelle' => 'Public',
        'rang' => 0,
    ]);

    $service = Service::create([
        'libelle' => 'Direction',
    ]);

    $sender = User::factory()->create([
        'role' => 'admin',
        'service_id' => $service->id,
        'niveau_confidentialite_id' => $niveau->id,
    ]);

    $receiver = User::factory()->create([
        'role' => 'secretaire',
        'service_id' => $service->id,
        'niveau_confidentialite_id' => $niveau->id,
    ]);

    $thirdUser = User::factory()->create([
        'role' => 'chef',
        'service_id' => $service->id,
        'niveau_confidentialite_id' => $niveau->id,
    ]);

    $courrier = Courrier::create([
        'numero' => 'COUR-MSG-001',
        'objet' => 'Courrier lie au message',
        'type' => 'sortant',
        'date_creation' => now(),
        'date_reception' => now(),
        'expediteur' => 'Direction',
        'destinataire' => 'Prefecture',
        'statut' => 'CREE',
        'niveau_confidentialite_id' => $niveau->id,
        'createur_id' => $sender->id,
    ]);

    return [$sender, $receiver, $thirdUser, $courrier];
}

test('received messages endpoint returns only recipient messages', function () {
    [$sender, $receiver, $thirdUser] = createMessageFixtures();

    Message::create([
        'contenu' => 'Message recu',
        'date_envoi' => now(),
        'lu' => false,
        'emetteur_id' => $sender->id,
        'destinataire_id' => $receiver->id,
    ]);

    Message::create([
        'contenu' => 'Message autre boite',
        'date_envoi' => now(),
        'lu' => false,
        'emetteur_id' => $sender->id,
        'destinataire_id' => $thirdUser->id,
    ]);

    $this->actingAs($receiver)
        ->getJson('/api/messages?type=recu')
        ->assertOk()
        ->assertJsonPath('messages.total', 1)
        ->assertJsonPath('messages.data.0.contenu', 'Message recu');
});

test('destinataires endpoint returns suggestions when query is empty', function () {
    [$sender, $receiver, $thirdUser] = createMessageFixtures();

    $response = $this->actingAs($sender)
        ->getJson('/api/messages/destinataires?q=')
        ->assertOk();

    $ids = collect($response->json('utilisateurs'))->pluck('id')->all();

    expect($ids)->not->toContain($sender->id);
    expect($ids)->toContain($receiver->id);
    expect($ids)->toContain($thirdUser->id);
});

test('user can send and update an unread message', function () {
    [$sender, $receiver, , $courrier] = createMessageFixtures();

    $response = $this->actingAs($sender)
        ->postJson('/api/messages', [
            'destinataire_id' => $receiver->id,
            'contenu' => 'Premier contenu',
            'courrier_id' => $courrier->id,
            'envoyer' => false,
        ])
        ->assertCreated()
        ->assertJsonPath('data.contenu', 'Premier contenu');

    $messageId = $response->json('data.id');

    $this->actingAs($sender)
        ->patchJson("/api/messages/{$messageId}", [
            'contenu' => 'Contenu mis a jour',
            'courrier_id' => $courrier->id,
        ])
        ->assertOk()
        ->assertJsonPath('data.contenu', 'Contenu mis a jour');

    // Send the draft, then it becomes immutable.
    $this->actingAs($sender)
        ->patchJson("/api/messages/{$messageId}/send")
        ->assertOk()
        ->assertJsonPath('data.statut', 'ENVOYE');

    $this->actingAs($sender)
        ->patchJson("/api/messages/{$messageId}", [
            'contenu' => 'Tentative après envoi',
        ])
        ->assertStatus(422)
        ->assertJsonPath('error', 'Impossible de modifier un message déjà envoyé.');

    $this->actingAs($sender)
        ->deleteJson("/api/messages/{$messageId}")
        ->assertStatus(422)
        ->assertJsonPath('error', 'Impossible de supprimer un message déjà envoyé.');
});

test('recipient can mark a message as read and sender can no longer edit it', function () {
    [$sender, $receiver] = createMessageFixtures();

    $message = Message::create([
        'contenu' => 'Lecture requise',
        'date_envoi' => now(),
        'lu' => false,
        'statut' => 'ENVOYE',
        'emetteur_id' => $sender->id,
        'destinataire_id' => $receiver->id,
    ]);

    $this->actingAs($receiver)
        ->patchJson("/api/messages/{$message->id}/read")
        ->assertOk()
        ->assertJsonPath('data.lu', true);

    $this->actingAs($sender)
        ->patchJson("/api/messages/{$message->id}", [
            'contenu' => 'Tentative après lecture',
        ])
        ->assertStatus(422)
        ->assertJsonPath('error', 'Impossible de modifier un message déjà envoyé.');
});

test('sender or recipient can delete a message', function () {
    [$sender, $receiver] = createMessageFixtures();

    $message = Message::create([
        'contenu' => 'Suppression',
        'date_envoi' => now(),
        'lu' => false,
        'statut' => 'CREE',
        'emetteur_id' => $sender->id,
        'destinataire_id' => $receiver->id,
    ]);

    $this->actingAs($sender)
        ->deleteJson("/api/messages/{$message->id}")
        ->assertOk();

    $this->assertDatabaseMissing('messages', [
        'id' => $message->id,
    ]);
});
