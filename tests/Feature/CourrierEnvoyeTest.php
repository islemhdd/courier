<?php

use App\Models\Courrier;
use App\Models\NiveauConfidentialite;
use App\Models\Service;
use App\Models\User;

function createCourrierUser(string $role = 'admin'): array
{
    $niveau = NiveauConfidentialite::create([
        'libelle' => 'Public',
        'rang' => 0,
    ]);

    $service = Service::create([
        'libelle' => 'Direction',
    ]);

    $user = User::factory()->create([
        'role' => $role,
        'service_id' => $service->id,
        'niveau_confidentialite_id' => $niveau->id,
    ]);

    return [$user, $niveau, $service];
}

test('sent courriers endpoint returns only outgoing courriers', function () {
    [$user, $niveau] = createCourrierUser();

    Courrier::create([
        'numero' => 'COUR-TEST-SENT',
        'objet' => 'Courrier sortant',
        'type' => 'sortant',
        'date_creation' => now(),
        'date_reception' => now(),
        'expediteur' => 'Direction',
        'destinataire' => 'Ministere',
        'statut' => 'CREE',
        'niveau_confidentialite_id' => $niveau->id,
        'createur_id' => $user->id,
    ]);

    Courrier::create([
        'numero' => 'COUR-TEST-RECEIVED',
        'objet' => 'Courrier entrant',
        'type' => 'entrant',
        'date_creation' => now(),
        'date_reception' => now(),
        'expediteur' => 'Partenaire',
        'statut' => 'CREE',
        'niveau_confidentialite_id' => $niveau->id,
        'createur_id' => $user->id,
    ]);

    $this->actingAs($user)
        ->getJson('/api/courriers/envoyes')
        ->assertOk()
        ->assertJsonPath('courriers.total', 1)
        ->assertJsonPath('courriers.data.0.type', 'sortant')
        ->assertJsonPath('courriers.data.0.destinataire', 'Ministere');
});

test('authorized users can create an outgoing courrier', function () {
    [$user, $niveau, $service] = createCourrierUser('secretaire');

    $this->actingAs($user)
        ->postJson('/api/courriers', [
            'objet' => 'Convocation transmise',
            'type' => 'sortant',
            'date_reception' => now()->toDateString(),
            'destinataire' => 'Wilaya',
            'niveau_confidentialite_id' => $niveau->id,
        ])
        ->assertCreated()
        ->assertJsonPath('courrier.type', 'sortant')
        ->assertJsonPath('courrier.destinataire', 'Wilaya')
        ->assertJsonPath('courrier.expediteur', $service->libelle);

    $this->assertDatabaseHas('courriers', [
        'objet' => 'Convocation transmise',
        'type' => 'sortant',
        'destinataire' => 'Wilaya',
        'expediteur' => $service->libelle,
    ]);
});
