<?php

use App\Models\Archive;
use App\Models\Courrier;
use App\Models\NiveauConfidentialite;
use App\Models\Service;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(Tests\TestCase::class, RefreshDatabase::class);

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
        'service_source_id' => $user->service_id,
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
        'service_source_id' => $user->service_id,
    ]);

    $this->actingAs($user)
        ->getJson('/api/courriers/envoyes')
        ->assertOk()
        ->assertJsonPath('courriers.total', 1)
        ->assertJsonPath('courriers.data.0.type', 'sortant')
        ->assertJsonPath('courriers.data.0.destinataire', 'Ministere');
});

test('archives endpoint reads from archive table only', function () {
    [$user, $niveau] = createCourrierUser();

    Archive::create([
        'courrier_original_id' => 99,
        'numero' => 'COUR-TEST-ARCHIVE-1',
        'objet' => 'Archive officielle',
        'type' => 'sortant',
        'date_creation' => now(),
        'date_reception' => now(),
        'expediteur' => 'Direction',
        'destinataire' => 'Archives Nationales',
        'statut_original' => 'TRANSMIS',
        'niveau_confidentialite_id' => $niveau->id,
        'createur_id' => $user->id,
        'service_source_id' => $user->service_id,
        'archive_par_id' => $user->id,
        'archive_le' => now(),
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
        'service_source_id' => $user->service_id,
    ]);

    $this->actingAs($user)
        ->getJson('/api/courriers/archives')
        ->assertOk()
        ->assertJsonPath('archives.total', 1)
        ->assertJsonPath('archives.data.0.statut_original', 'TRANSMIS')
        ->assertJsonPath('archives.data.0.numero', 'COUR-TEST-ARCHIVE-1');
});

test('secretary creates outgoing courrier in created state', function () {
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
        ->assertJsonPath('courrier.statut', 'CREE')
        ->assertJsonPath('courrier.destinataire', 'Wilaya')
        ->assertJsonPath('courrier.expediteur', $service->libelle);
});

test('chef creates outgoing courrier directly validated', function () {
    [$chef, $niveau] = createCourrierUser('chef');

    $this->actingAs($chef)
        ->postJson('/api/courriers', [
            'objet' => 'Note de service',
            'type' => 'sortant',
            'date_reception' => now()->toDateString(),
            'destinataire' => 'Service RH',
            'niveau_confidentialite_id' => $niveau->id,
        ])
        ->assertCreated()
        ->assertJsonPath('courrier.statut', 'VALIDE');
});

test('validation endpoint returns only created courriers pending validation', function () {
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
        'service_source_id' => $service->id,
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
        'service_source_id' => $service->id,
    ]);

    $this->actingAs($chef)
        ->getJson('/api/courriers/validation')
        ->assertOk()
        ->assertJsonPath('courriers.total', 1)
        ->assertJsonPath('courriers.data.0.numero', 'COUR-VALID-001')
        ->assertJsonPath('courriers.data.0.peut_etre_valide', true);
});

test('chef can validate courrier once', function () {
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
        'service_source_id' => $service->id,
    ]);

    $this->actingAs($chef)
        ->patchJson("/api/courriers/{$courrier->id}/valider")
        ->assertOk()
        ->assertJsonPath('courrier.statut', 'VALIDE');

    $this->actingAs($chef)
        ->patchJson("/api/courriers/{$courrier->id}/valider")
        ->assertStatus(422);
});

test('transmission archives outgoing courrier and creates received courrier for target service', function () {
    [$chef, $niveau, $sourceService] = createCourrierUser('chef');
    $targetService = Service::create(['libelle' => 'Ressources Humaines']);

    $courrier = Courrier::create([
        'numero' => 'COUR-TRANSMIT-001',
        'objet' => 'Dossier a transmettre',
        'type' => 'sortant',
        'date_creation' => now(),
        'date_reception' => now(),
        'expediteur' => 'Direction',
        'destinataire' => 'RH',
        'statut' => 'VALIDE',
        'niveau_confidentialite_id' => $niveau->id,
        'createur_id' => $chef->id,
        'valideur_id' => $chef->id,
        'service_source_id' => $sourceService->id,
        'service_destinataire_id' => $targetService->id,
    ]);

    $this->actingAs($chef)
        ->patchJson("/api/courriers/{$courrier->id}/transmettre")
        ->assertOk()
        ->assertJsonPath('archive.statut_original', 'TRANSMIS')
        ->assertJsonPath('courrier_recu.statut', 'RECU');

    $this->assertDatabaseMissing('courriers', [
        'id' => $courrier->id,
    ]);

    $this->assertDatabaseHas('archives', [
        'courrier_original_id' => $courrier->id,
        'numero' => 'COUR-TRANSMIT-001',
        'statut_original' => 'TRANSMIS',
    ]);
});

test('manual archive copies received courrier then deletes original', function () {
    [$user, $niveau, $service] = createCourrierUser('secretaire');

    $courrier = Courrier::create([
        'numero' => 'COUR-RECU-ARCHIVE',
        'objet' => 'Courrier recu',
        'type' => 'entrant',
        'date_creation' => now(),
        'date_reception' => now(),
        'expediteur' => 'Partenaire',
        'destinataire' => 'Direction',
        'statut' => 'RECU',
        'niveau_confidentialite_id' => $niveau->id,
        'createur_id' => $user->id,
        'service_destinataire_id' => $service->id,
    ]);

    $this->actingAs($user)
        ->patchJson("/api/courriers/{$courrier->id}/archiver")
        ->assertOk()
        ->assertJsonPath('archive.statut_original', 'RECU');

    $this->assertDatabaseMissing('courriers', [
        'id' => $courrier->id,
    ]);
});
