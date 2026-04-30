<?php

use App\Models\Archive;
use App\Models\Courrier;
use App\Models\NiveauConfidentialite;
use App\Models\Service;
use App\Models\User;
use Illuminate\Support\Facades\Artisan;

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

test('restricted courrier keeps metadata visible but hides detailed access markers', function () {
    $niveauBas = NiveauConfidentialite::create([
        'libelle' => 'Interne',
        'rang' => 1,
    ]);

    $niveauHaut = NiveauConfidentialite::create([
        'libelle' => 'Secret',
        'rang' => 5,
    ]);

    $service = Service::create([
        'libelle' => 'Finances',
    ]);

    $createur = User::factory()->create([
        'role' => 'secretaire',
        'service_id' => $service->id,
        'niveau_confidentialite_id' => $niveauHaut->id,
    ]);

    $lecteur = User::factory()->create([
        'role' => 'secretaire',
        'service_id' => $service->id,
        'niveau_confidentialite_id' => $niveauBas->id,
    ]);

    $courrier = Courrier::create([
        'numero' => 'COUR-RESTREINT-001',
        'objet' => 'Rapport budgetaire detaille',
        'type' => 'sortant',
        'date_creation' => now(),
        'date_reception' => now(),
        'expediteur' => 'Direction Financiere',
        'destinataire' => 'Tresor',
        'statut' => 'CREE',
        'niveau_confidentialite_id' => $niveauHaut->id,
        'createur_id' => $createur->id,
        'service_source_id' => $service->id,
        'chemin_fichier' => 'courriers/rapport.pdf',
    ]);

    $this->actingAs($lecteur)
        ->getJson("/api/courriers/{$courrier->id}")
        ->assertOk()
        ->assertJsonPath('courrier.peut_voir_details', false)
        ->assertJsonPath('courrier.contenu_restreint', true)
        ->assertJsonPath('courrier.numero', 'COUR-RESTREINT-001')
        ->assertJsonPath('courrier.objet', 'Rapport budgetaire detaille')
        ->assertJsonPath('courrier.chemin_fichier', null);
});

test('secretary can delete only own courrier in created or non validated state', function () {
    [$user, $niveau, $service] = createCourrierUser('secretaire');

    $autre = User::factory()->create([
        'role' => 'secretaire',
        'service_id' => $service->id,
        'niveau_confidentialite_id' => $niveau->id,
    ]);

    $courrierNonValide = Courrier::create([
        'numero' => 'COUR-NON-VALID-DEL',
        'objet' => 'Retour pour correction',
        'type' => 'sortant',
        'date_creation' => now(),
        'date_reception' => now(),
        'expediteur' => 'Direction',
        'destinataire' => 'Wilaya',
        'statut' => 'NON_VALIDE',
        'niveau_confidentialite_id' => $niveau->id,
        'createur_id' => $user->id,
        'service_source_id' => $service->id,
    ]);

    $courrierValide = Courrier::create([
        'numero' => 'COUR-VALID-DEL',
        'objet' => 'Deja valide',
        'type' => 'sortant',
        'date_creation' => now(),
        'date_reception' => now(),
        'expediteur' => 'Direction',
        'destinataire' => 'Wilaya',
        'statut' => 'VALIDE',
        'niveau_confidentialite_id' => $niveau->id,
        'createur_id' => $user->id,
        'service_source_id' => $service->id,
    ]);

    $courrierAutre = Courrier::create([
        'numero' => 'COUR-AUTRE-DEL',
        'objet' => 'Courrier autre createur',
        'type' => 'sortant',
        'date_creation' => now(),
        'date_reception' => now(),
        'expediteur' => 'Direction',
        'destinataire' => 'Wilaya',
        'statut' => 'CREE',
        'niveau_confidentialite_id' => $niveau->id,
        'createur_id' => $autre->id,
        'service_source_id' => $service->id,
    ]);

    $this->actingAs($user)
        ->deleteJson("/api/courriers/{$courrierNonValide->id}")
        ->assertOk();

    $this->actingAs($user)
        ->deleteJson("/api/courriers/{$courrierValide->id}")
        ->assertStatus(403);

    $this->actingAs($user)
        ->deleteJson("/api/courriers/{$courrierAutre->id}")
        ->assertStatus(403);
});

test('validated courrier can be updated by chef but not by secretary', function () {
    [$chef, $niveau, $service] = createCourrierUser('chef');

    $secretaire = User::factory()->create([
        'role' => 'secretaire',
        'service_id' => $service->id,
        'niveau_confidentialite_id' => $niveau->id,
    ]);

    $courrier = Courrier::create([
        'numero' => 'COUR-VALID-UPD',
        'objet' => 'Objet initial',
        'type' => 'sortant',
        'date_creation' => now(),
        'date_reception' => now(),
        'expediteur' => 'Direction',
        'destinataire' => 'Wilaya',
        'statut' => 'VALIDE',
        'niveau_confidentialite_id' => $niveau->id,
        'createur_id' => $secretaire->id,
        'service_source_id' => $service->id,
        'valideur_id' => $chef->id,
    ]);

    $this->actingAs($secretaire)
        ->patchJson("/api/courriers/{$courrier->id}", [
            'objet' => 'Objet modifie secretaire',
        ])
        ->assertStatus(403);

    $this->actingAs($chef)
        ->patchJson("/api/courriers/{$courrier->id}", [
            'objet' => 'Objet modifie chef',
        ])
        ->assertOk()
        ->assertJsonPath('courrier.objet', 'Objet modifie chef');
});

test('chef can mark courrier as non validated', function () {
    [$chef, $niveau, $service] = createCourrierUser('chef');

    $secretaire = User::factory()->create([
        'role' => 'secretaire',
        'service_id' => $service->id,
        'niveau_confidentialite_id' => $niveau->id,
    ]);

    $courrier = Courrier::create([
        'numero' => 'COUR-NON-VALIDATE',
        'objet' => 'Dossier a corriger',
        'type' => 'sortant',
        'date_creation' => now(),
        'date_reception' => now(),
        'expediteur' => 'Direction',
        'destinataire' => 'Ministere',
        'statut' => 'CREE',
        'niveau_confidentialite_id' => $niveau->id,
        'createur_id' => $secretaire->id,
        'service_source_id' => $service->id,
    ]);

    $this->actingAs($chef)
        ->patchJson("/api/courriers/{$courrier->id}/non-valider")
        ->assertOk()
        ->assertJsonPath('courrier.statut', 'NON_VALIDE');
});

test('chef of destination service can see and validate courrier in validation queue', function () {
    [$chefDestination, $niveau, $serviceDestination] = createCourrierUser('chef');
    $serviceSource = Service::create(['libelle' => 'Service Source']);

    $secretaireSource = User::factory()->create([
        'role' => 'secretaire',
        'service_id' => $serviceSource->id,
        'niveau_confidentialite_id' => $niveau->id,
    ]);

    $courrier = Courrier::create([
        'numero' => 'COUR-DEST-VALID',
        'objet' => 'Courrier pour le service destinataire',
        'type' => 'sortant',
        'date_creation' => now(),
        'date_reception' => now(),
        'expediteur' => 'Service Source',
        'destinataire' => $serviceDestination->libelle,
        'statut' => 'CREE',
        'niveau_confidentialite_id' => $niveau->id,
        'createur_id' => $secretaireSource->id,
        'service_source_id' => $serviceSource->id,
        'service_destinataire_id' => $serviceDestination->id,
    ]);

    $this->actingAs($chefDestination)
        ->getJson('/api/courriers/validation')
        ->assertOk()
        ->assertJsonPath('courriers.total', 1)
        ->assertJsonPath('courriers.data.0.numero', 'COUR-DEST-VALID')
        ->assertJsonPath('courriers.data.0.peut_etre_valide', true);

    $this->actingAs($chefDestination)
        ->patchJson("/api/courriers/{$courrier->id}/valider")
        ->assertOk()
        ->assertJsonPath('courrier.statut', 'VALIDE');
});

test('chef sees only courriers of his own service', function () {
    [$chef, $niveau, $serviceChef] = createCourrierUser('chef');
    $autreService = Service::create(['libelle' => 'Autre Service']);

    $createurChef = User::factory()->create([
        'role' => 'secretaire',
        'service_id' => $serviceChef->id,
        'niveau_confidentialite_id' => $niveau->id,
    ]);

    $createurAutre = User::factory()->create([
        'role' => 'secretaire',
        'service_id' => $autreService->id,
        'niveau_confidentialite_id' => $niveau->id,
    ]);

    $courrierVisible = Courrier::create([
        'numero' => 'COUR-CHEF-VISIBLE',
        'objet' => 'Courrier du service du chef',
        'type' => 'sortant',
        'date_creation' => now(),
        'date_reception' => now(),
        'expediteur' => 'Direction',
        'destinataire' => 'Ministere',
        'statut' => 'CREE',
        'niveau_confidentialite_id' => $niveau->id,
        'createur_id' => $createurChef->id,
        'service_source_id' => $serviceChef->id,
    ]);

    $courrierCache = Courrier::create([
        'numero' => 'COUR-CHEF-CACHE',
        'objet' => 'Courrier hors service',
        'type' => 'sortant',
        'date_creation' => now(),
        'date_reception' => now(),
        'expediteur' => 'Autre Direction',
        'destinataire' => 'Prefecture',
        'statut' => 'CREE',
        'niveau_confidentialite_id' => $niveau->id,
        'createur_id' => $createurAutre->id,
        'service_source_id' => $autreService->id,
    ]);

    $this->actingAs($chef)
        ->getJson('/api/courriers')
        ->assertOk()
        ->assertJsonPath('courriers.total', 1)
        ->assertJsonPath('courriers.data.0.numero', 'COUR-CHEF-VISIBLE');

    $this->actingAs($chef)
        ->getJson("/api/courriers/{$courrierVisible->id}")
        ->assertOk();

    $this->actingAs($chef)
        ->getJson("/api/courriers/{$courrierCache->id}")
        ->assertStatus(403);
});

test('monthly command archives validated courriers automatically', function () {
    [$chef, $niveau, $service] = createCourrierUser('chef');

    $courrier = Courrier::create([
        'numero' => 'COUR-MONTHLY-VALID',
        'objet' => 'Courrier valide a archiver',
        'type' => 'sortant',
        'date_creation' => now()->subDays(10),
        'date_reception' => now()->subDays(10),
        'expediteur' => 'Direction',
        'destinataire' => 'Ministere',
        'statut' => 'VALIDE',
        'niveau_confidentialite_id' => $niveau->id,
        'createur_id' => $chef->id,
        'valideur_id' => $chef->id,
        'service_source_id' => $service->id,
    ]);

    Artisan::call('courriers:archiver-valides');

    $this->assertDatabaseMissing('courriers', [
        'id' => $courrier->id,
    ]);

    $this->assertDatabaseHas('archives', [
        'courrier_original_id' => $courrier->id,
        'numero' => 'COUR-MONTHLY-VALID',
        'statut_original' => 'VALIDE',
    ]);
});
