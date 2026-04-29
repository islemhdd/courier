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

test('archives endpoint returns only archived courriers visible to the user', function () {
    [$user, $niveau] = createCourrierUser();

    Courrier::create([
        'numero' => 'COUR-TEST-ARCHIVE-1',
        'objet' => 'Archive officielle',
        'type' => 'sortant',
        'date_creation' => now(),
        'date_reception' => now(),
        'expediteur' => 'Direction',
        'destinataire' => 'Archives Nationales',
        'statut' => 'ARCHIVE',
        'niveau_confidentialite_id' => $niveau->id,
        'createur_id' => $user->id,
    ]);

    Courrier::create([
        'numero' => 'COUR-TEST-ACTIF-2',
        'objet' => 'Courrier actif',
        'type' => 'sortant',
        'date_creation' => now(),
        'date_reception' => now(),
        'expediteur' => 'Direction',
        'destinataire' => 'Ministere',
        'statut' => 'CREE',
        'niveau_confidentialite_id' => $niveau->id,
        'createur_id' => $user->id,
    ]);

    $this->actingAs($user)
        ->getJson('/api/courriers/archives')
        ->assertOk()
        ->assertJsonPath('courriers.total', 1)
        ->assertJsonPath('courriers.data.0.statut', 'ARCHIVE')
        ->assertJsonPath('courriers.data.0.numero', 'COUR-TEST-ARCHIVE-1');
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

test('creator can archive a courrier but cannot archive it twice', function () {
    [$user, $niveau] = createCourrierUser('secretaire');

    $courrier = Courrier::create([
        'numero' => 'COUR-TEST-ARCHIVE-ACTION',
        'objet' => 'Dossier a archiver',
        'type' => 'sortant',
        'date_creation' => now(),
        'date_reception' => now(),
        'expediteur' => 'Direction',
        'destinataire' => 'Prefecture',
        'statut' => 'CREE',
        'niveau_confidentialite_id' => $niveau->id,
        'createur_id' => $user->id,
    ]);

    $this->actingAs($user)
        ->patchJson("/api/courriers/{$courrier->id}/archiver")
        ->assertOk()
        ->assertJsonPath('courrier.statut', 'ARCHIVE');

    $this->actingAs($user)
        ->patchJson("/api/courriers/{$courrier->id}/archiver")
        ->assertStatus(422)
        ->assertJsonPath('error', 'Ce courrier est déjà archivé.');
});

test('validation endpoint returns only courriers pending validation', function () {
    [$chef, $niveau, $service] = createCourrierUser('chef');

    $createur = User::factory()->create([
        'role' => 'secretaire',
        'service_id' => $service->id,
        'niveau_confidentialite_id' => $niveau->id,
    ]);

    Courrier::create([
        'numero' => 'COUR-VALID-001',
        'objet' => 'A valider',
        'type' => 'sortant',
        'date_creation' => now(),
        'date_reception' => now(),
        'expediteur' => 'Direction',
        'destinataire' => 'Ministere',
        'statut' => 'CREE',
        'niveau_confidentialite_id' => $niveau->id,
        'createur_id' => $createur->id,
    ]);

    Courrier::create([
        'numero' => 'COUR-VALID-002',
        'objet' => 'Deja valide',
        'type' => 'sortant',
        'date_creation' => now(),
        'date_reception' => now(),
        'expediteur' => 'Direction',
        'destinataire' => 'Prefecture',
        'statut' => 'VALIDE',
        'niveau_confidentialite_id' => $niveau->id,
        'createur_id' => $createur->id,
    ]);

    $this->actingAs($chef)
        ->getJson('/api/courriers/validation')
        ->assertOk()
        ->assertJsonPath('courriers.total', 1)
        ->assertJsonPath('courriers.data.0.numero', 'COUR-VALID-001')
        ->assertJsonPath('courriers.data.0.peut_etre_valide', true);
});

test('chef can validate courrier once but cannot validate it twice', function () {
    [$chef, $niveau, $service] = createCourrierUser('chef');

    $createur = User::factory()->create([
        'role' => 'secretaire',
        'service_id' => $service->id,
        'niveau_confidentialite_id' => $niveau->id,
    ]);

    $courrier = Courrier::create([
        'numero' => 'COUR-VALID-ACTION',
        'objet' => 'Dossier en attente',
        'type' => 'sortant',
        'date_creation' => now(),
        'date_reception' => now(),
        'expediteur' => 'Direction',
        'destinataire' => 'Wilaya',
        'statut' => 'CREE',
        'niveau_confidentialite_id' => $niveau->id,
        'createur_id' => $createur->id,
    ]);

    $this->actingAs($chef)
        ->patchJson("/api/courriers/{$courrier->id}/valider")
        ->assertOk()
        ->assertJsonPath('courrier.statut', 'VALIDE');

    $this->actingAs($chef)
        ->patchJson("/api/courriers/{$courrier->id}/valider")
        ->assertStatus(422)
        ->assertJsonPath('error', 'Ce courrier ne peut plus être validé.');
});

test('chef can see all courriers with full details', function () {
    [$chef, $niveau] = createCourrierUser('chef');

    $autreService = Service::create([
        'libelle' => 'Finances',
    ]);

    $createur = User::factory()->create([
        'role' => 'secretaire',
        'service_id' => $autreService->id,
        'niveau_confidentialite_id' => $niveau->id,
    ]);

    $courrier = Courrier::create([
        'numero' => 'COUR-VIS-CHEF',
        'objet' => 'Budget confidentiel',
        'type' => 'entrant',
        'date_creation' => now(),
        'date_reception' => now(),
        'expediteur' => 'Tresor',
        'destinataire' => 'Direction',
        'statut' => 'CREE',
        'niveau_confidentialite_id' => $niveau->id,
        'createur_id' => $createur->id,
    ]);

    $this->actingAs($chef)
        ->getJson('/api/courriers')
        ->assertOk()
        ->assertJsonPath('courriers.total', 1)
        ->assertJsonPath('courriers.data.0.peut_voir_details', true)
        ->assertJsonPath('courriers.data.0.objet', 'Budget confidentiel');

    $this->actingAs($chef)
        ->getJson("/api/courriers/{$courrier->id}")
        ->assertOk()
        ->assertJsonPath('courrier.objet', 'Budget confidentiel')
        ->assertJsonPath('courrier.peut_voir_details', true);
});

test('secretary sees only courriers from the same service and restricted details are masked', function () {
    $niveauFaible = NiveauConfidentialite::create([
        'libelle' => 'Interne',
        'rang' => 1,
    ]);

    $niveauEleve = NiveauConfidentialite::create([
        'libelle' => 'Secret',
        'rang' => 5,
    ]);

    $service = Service::create([
        'libelle' => 'Direction',
    ]);

    $autreService = Service::create([
        'libelle' => 'Technique',
    ]);

    $secretaire = User::factory()->create([
        'role' => 'secretaire',
        'service_id' => $service->id,
        'niveau_confidentialite_id' => $niveauFaible->id,
    ]);

    $memeService = User::factory()->create([
        'role' => 'secretaire',
        'service_id' => $service->id,
        'niveau_confidentialite_id' => $niveauEleve->id,
    ]);

    $autreCreateur = User::factory()->create([
        'role' => 'secretaire',
        'service_id' => $autreService->id,
        'niveau_confidentialite_id' => $niveauFaible->id,
    ]);

    $courrierRestreint = Courrier::create([
        'numero' => 'COUR-VIS-RESTREINT',
        'objet' => 'Objet confidentiel',
        'type' => 'entrant',
        'date_creation' => now(),
        'date_reception' => now(),
        'expediteur' => 'Ministere',
        'destinataire' => 'Direction',
        'statut' => 'CREE',
        'niveau_confidentialite_id' => $niveauEleve->id,
        'createur_id' => $memeService->id,
    ]);

    Courrier::create([
        'numero' => 'COUR-HORS-SERVICE',
        'objet' => 'Hors service',
        'type' => 'entrant',
        'date_creation' => now(),
        'date_reception' => now(),
        'expediteur' => 'Externe',
        'destinataire' => 'Technique',
        'statut' => 'CREE',
        'niveau_confidentialite_id' => $niveauFaible->id,
        'createur_id' => $autreCreateur->id,
    ]);

    $this->actingAs($secretaire)
        ->getJson('/api/courriers')
        ->assertOk()
        ->assertJsonPath('courriers.total', 1)
        ->assertJsonPath('courriers.data.0.numero', 'COUR-VIS-RESTREINT')
        ->assertJsonPath('courriers.data.0.peut_voir_details', false)
        ->assertJsonPath('courriers.data.0.objet', 'Contenu restreint');

    $this->actingAs($secretaire)
        ->getJson("/api/courriers/{$courrierRestreint->id}")
        ->assertOk()
        ->assertJsonPath('courrier.peut_voir_details', false)
        ->assertJsonPath('courrier.objet', 'Contenu restreint')
        ->assertJsonPath('courrier.expediteur', 'Accès restreint');
});
