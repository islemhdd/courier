<?php

use App\Models\Courrier;
use App\Models\NiveauConfidentialite;
use App\Models\Service;
use App\Models\Structure;
use App\Models\User;
use App\Models\Message;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

beforeEach(function () {
    Structure::create(['id' => 1, 'libelle' => 'Structure Centrale']);
    Structure::create(['id' => 2, 'libelle' => 'Structure Regionale']);

    Service::create(['id' => 1, 'libelle' => 'Direction Generale', 'structure_id' => 1]);
    Service::create(['id' => 2, 'libelle' => 'Service Courrier', 'structure_id' => 1]);
    Service::create(['id' => 3, 'libelle' => 'Service Regional Est', 'structure_id' => 2]);

    NiveauConfidentialite::create(['id' => 1, 'libelle' => 'Public', 'rang' => 0]);
    NiveauConfidentialite::create(['id' => 2, 'libelle' => 'Interne', 'rang' => 1]);
    NiveauConfidentialite::create(['id' => 3, 'libelle' => 'Confidentiel', 'rang' => 2]);

    DB::table('sources')->insert(['id' => 1, 'libelle' => 'Courrier Depart']);
});

test('scenario global : cycle de vie complet du courrier', function () {
    // ====== 1. ADMIN : Création de l'organisation et des utilisateurs ======

    $admin = User::factory()->create([
        'role' => 'admin',
        'role_scope' => 'general',
        'service_id' => 1,
        'niveau_confidentialite_id' => 3,
    ]);

    // Admin crée un Chef General
    $chefGeneral = $this->actingAs($admin)->postJson('/api/utilisateurs', [
        'nom' => 'Chef',
        'prenom' => 'General',
        'email' => 'chef.general@test.dz',
        'password' => 'password',
        'password_confirmation' => 'password',
        'role' => 'chef',
        'role_scope' => 'general',
        'service_id' => 1,
        'niveau_confidentialite_id' => 3,
    ])->assertStatus(201)->json('utilisateur');

    $chefGeneral = User::find($chefGeneral['id']);

    // Admin crée un Chef de Structure
    $chefStructure = $this->actingAs($admin)->postJson('/api/utilisateurs', [
        'nom' => 'Chef',
        'prenom' => 'Structure',
        'email' => 'chef.structure@test.dz',
        'password' => 'password',
        'password_confirmation' => 'password',
        'role' => 'chef',
        'role_scope' => 'structure',
        'structure_id' => 1,
        'service_id' => 2,
        'niveau_confidentialite_id' => 2,
    ])->assertStatus(201)->json('utilisateur');

    $chefStructure = User::find($chefStructure['id']);

    // Admin crée un Secretaire (service différent du chef général)
    $secretaire = $this->actingAs($admin)->postJson('/api/utilisateurs', [
        'nom' => 'Secretaire',
        'prenom' => 'Test',
        'email' => 'secretaire@test.dz',
        'password' => 'password',
        'password_confirmation' => 'password',
        'role' => 'secretaire',
        'role_scope' => 'service',
        'service_id' => 2,
        'niveau_confidentialite_id' => 1,
    ])->assertStatus(201)->json('utilisateur');

    $secretaire = User::find($secretaire['id']);

    // ====== 2. AUTH : Vérification de la session ======

    // Vérifier qu'on récupère l'utilisateur connecté
    $this->actingAs($admin)->getJson('/api/user')->assertOk()->assertJsonPath('user.id', $admin->id);

    // ====== 3. CHEF GENERAL : Création d'un courrier entrant ======

    $file = UploadedFile::fake()->create('courrier.pdf', 1024);
    $courrierEntrant = $this->actingAs($chefGeneral)->post('/api/courriers', [
        'type' => 'entrant',
        'objet' => 'Demande de subvention annuelle',
        'resume' => 'Demande de financement pour projets 2025',
        'expediteur' => 'Ministere des Finances',
        'destinataire' => 'Direction Generale',
        'date_reception' => now()->format('Y-m-d'),
        'niveau_confidentialite_id' => 1,
        'service_destinataire_id' => 2,
        'mode_diffusion' => 'unicast',
        'recipients' => [
            ['recipient_type' => 'service', 'service_id' => 2],
        ],
        'fichier' => $file,
    ])->assertStatus(201)->json('courrier');

    // Vérifier : un courrier entrant créé par chef général est directement RECU
    expect($courrierEntrant['statut'])->toBe('RECU');

    // ====== 4. SECRETAIRE : Création d'un courrier sortant ======

    $courrierSortant = $this->actingAs($secretaire)->postJson('/api/courriers', [
        'type' => 'sortant',
        'objet' => 'Reponse a la demande de subvention',
        'resume' => 'Accord de principe pour le financement',
        'destinataire' => 'Ministere des Finances',
        'date_reception' => now()->format('Y-m-d'),
        'niveau_confidentialite_id' => 1,
        'source_id' => 1,
        'service_source_id' => 2,
        'mode_diffusion' => 'unicast',
    ])->assertStatus(201)->json('courrier');

    // Vérifier : un courrier sortant créé par secretaire est en statut CREE (en attente validation)
    expect($courrierSortant['statut'])->toBe('CREE');

    // Vérifier : le secretaire voit le courrier dans la liste des envoyes
    $this->actingAs($secretaire)->getJson('/api/courriers/envoyes')
        ->assertOk()
        ->assertJsonPath('courriers.total', 1);

    // ====== 5. VALIDATION : Le chef valide le courrier sortant ======

    // Le chef general voit le courrier en validation
    $this->actingAs($chefGeneral)->getJson('/api/courriers/validation')
        ->assertOk()
        ->assertJsonPath('courriers.total', 1);

    // Validation
    $this->actingAs($chefGeneral)->patchJson("/api/courriers/{$courrierSortant['id']}/valider")
        ->assertOk()
        ->assertJsonPath('courrier.statut', 'VALIDE');

    // ====== 6. STATS : Vérification du tableau de bord ======

    $this->actingAs($chefGeneral)->getJson('/api/courriers/stats')
        ->assertOk()
        ->assertJsonStructure(['courriers' => ['recus', 'envoyes', 'validation', 'archives']])
        ->assertJsonPath('courriers.recus', 1)
        ->assertJsonPath('courriers.envoyes', 1);

    // ====== 7. TRANSMISSION : Le chef transmet le courrier à un autre service ======

    $this->actingAs($chefGeneral)->patchJson("/api/courriers/{$courrierSortant['id']}/transmettre", [
        'recipients' => [
            ['recipient_type' => 'service', 'service_id' => 3],
        ],
        'mode_diffusion' => 'unicast',
        'commentaire' => 'A traiter en priorite',
    ])->assertOk()
        ->assertJsonPath('courrier.statut', 'TRANSMIS');

    // ====== 8. ARCHIVAGE : Archiver le courrier entrant ======

    $this->actingAs($chefGeneral)->patchJson("/api/courriers/{$courrierEntrant['id']}/archiver")
        ->assertOk();

    // Vérifier qu'il apparaît dans les archives
    $this->actingAs($chefGeneral)->getJson('/api/courriers/archives')
        ->assertOk()
        ->assertJsonPath('archives.total', 1);

    // ====== 9. MESSAGERIE INTERNE ======

    // Envoyer un message du chef general au secretaire
    $message = $this->actingAs($chefGeneral)->postJson('/api/messages', [
        'destinataire_id' => $secretaire->id,
        'contenu' => 'Merci de suivre le dossier de subvention.',
    ])->assertStatus(201)->json('data');

    expect($message['statut'])->toBe('ENVOYE');

    // Le secretaire voit le message dans sa boîte de réception
    $this->actingAs($secretaire)->getJson('/api/messages')
        ->assertOk()
        ->assertJsonPath('messages.total', 1);

    // Marquer comme lu
    $this->actingAs($secretaire)->patchJson("/api/messages/{$message['id']}/read")
        ->assertOk();

    // ====== 10. SECURITE : Vérification des permissions ======

    // Un secretaire ne peut PAS creer un courrier entrant
    $this->actingAs($secretaire)->postJson('/api/courriers', [
        'type' => 'entrant',
        'objet' => 'Tentative interdite',
        'resume' => 'Test',
        'expediteur' => 'Test',
        'date_reception' => now()->format('Y-m-d'),
        'niveau_confidentialite_id' => 1,
        'mode_diffusion' => 'unicast',
    ])->assertStatus(422);

    // Un secretaire ne peut PAS valider un courrier
    $courrierNonValide = $this->actingAs($secretaire)->postJson('/api/courriers', [
        'type' => 'sortant',
        'objet' => 'A valider par chef',
        'resume' => 'Test validation',
        'destinataire' => 'Test',
        'date_reception' => now()->format('Y-m-d'),
        'niveau_confidentialite_id' => 1,
        'source_id' => 1,
        'mode_diffusion' => 'unicast',
    ])->assertStatus(201)->json('courrier');

    // Le secretaire ne peut pas valider son propre courrier
    $this->actingAs($secretaire)->patchJson("/api/courriers/{$courrierNonValide['id']}/valider")
        ->assertStatus(403);

    // Un chef de structure ne peut pas creer un chef general (escalade privilege)
    $this->actingAs($chefStructure)->postJson('/api/utilisateurs', [
        'nom' => 'Hacker',
        'prenom' => 'Test',
        'email' => 'hacker@test.dz',
        'password' => 'password',
        'password_confirmation' => 'password',
        'role' => 'chef',
        'role_scope' => 'general',
        'service_id' => 1,
        'niveau_confidentialite_id' => 3,
    ])->assertStatus(403);

    // ====== 11. SUPPRESSION : Seul l'admin peut supprimer ======

    // Secretaire ne peut pas supprimer
    $this->actingAs($secretaire)->deleteJson("/api/courriers/{$courrierSortant['id']}")
        ->assertStatus(403);

    // Admin peut supprimer
    $this->actingAs($admin)->deleteJson("/api/courriers/{$courrierSortant['id']}")
        ->assertOk();
});

test('scenario global : reponse a un courrier avec notification', function () {
    // Setup
    $niveau = NiveauConfidentialite::find(1);
    $admin = User::factory()->create([
        'role' => 'admin',
        'role_scope' => 'general',
        'service_id' => 1,
        'niveau_confidentialite_id' => 3,
    ]);
    $chefService = User::factory()->create([
        'role' => 'chef',
        'role_scope' => 'service',
        'service_id' => 1,
        'niveau_confidentialite_id' => 2,
    ]);

    // Creer un courrier entrant qui requiert une reponse
    $file = UploadedFile::fake()->create('document.pdf', 1024);
    $courrier = $this->actingAs($admin)->post('/api/courriers', [
        'type' => 'entrant',
        'objet' => 'Demande urgente',
        'resume' => 'Besoin de reponse rapide',
        'expediteur' => 'Partenaire Externe',
        'date_reception' => now()->format('Y-m-d'),
        'niveau_confidentialite_id' => 1,
        'service_destinataire_id' => 1,
        'mode_diffusion' => 'unicast',
        'requiert_reponse' => true,
        'delai_reponse_jours' => 15,
        'recipients' => [
            ['recipient_type' => 'service', 'service_id' => 1],
        ],
        'fichier' => $file,
    ])->assertStatus(201)->json('courrier');

    expect($courrier['requiert_reponse'])->toBeTrue();

    // Repondre au courrier en tant que chef de service (destinataire)
    // Car le chef de service est destinataire via service_destinataire_id=1
    $reponse = $this->actingAs($chefService)->postJson('/api/courriers', [
        'type' => 'sortant',
        'objet' => 'RE: Demande urgente',
        'resume' => 'Voici notre reponse',
        'destinataire' => 'Partenaire Externe',
        'date_reception' => now()->format('Y-m-d'),
        'niveau_confidentialite_id' => 1,
        'source_id' => 1,
        'service_source_id' => 1,
        'mode_diffusion' => 'multicast',
        'parent_courrier_id' => $courrier['id'],
    ])->assertStatus(201)->json('courrier');

    expect($reponse['parent_courrier_id'])->toBe($courrier['id']);

    // Vérifier que le courrier original a ete marque comme repondu
    $this->actingAs($admin)->getJson("/api/courriers/{$courrier['id']}")
        ->assertOk()
        ->assertJsonPath('courrier.repondu_le', fn($v) => $v !== null);
});
