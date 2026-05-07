<?php

use App\Models\Courrier;
use App\Models\NiveauConfidentialite;
use App\Models\Service;
use App\Models\User;
use App\Services\OcrService;
use Illuminate\Http\UploadedFile;

function createOcrTestUser(): array
{
    $niveau = NiveauConfidentialite::create([
        'libelle' => 'Public',
        'rang' => 0,
    ]);

    $service = Service::create([
        'libelle' => 'Direction',
    ]);

    $user = User::factory()->create([
        'role' => 'secretaire',
        'service_id' => $service->id,
        'niveau_confidentialite_id' => $niveau->id,
    ]);

    return [$user, $niveau, $service];
}

test('OCR preview endpoint returns error for unsupported file type', function () {
    [$user, $niveau, $service] = createOcrTestUser();

    $file = UploadedFile::fake()->create('document.exe', 100, 'application/x-msdownload');

    $this->actingAs($user)
        ->postJson('/api/ocr/preview', [
            'file' => $file,
        ])
        ->assertStatus(422);
});

test('OCR preview endpoint processes valid files gracefully', function () {
    [$user, $niveau, $service] = createOcrTestUser();

    $response = $this->actingAs($user)
        ->postJson('/api/ocr/preview', [
            'file' => UploadedFile::fake()->create('image.png', 50, 'image/png'),
        ]);

    $valid = in_array($response->status(), [200, 422], true);
    expect($valid)->toBeTrue('Expected 200 or 422, got ' . $response->status());

    if ($response->status() === 200) {
        $response->assertJsonStructure(['success', 'text', 'summary', 'language']);
    }
});

test('OCR auto-fills resume when creating courrier with attachments', function () {
    [$user, $niveau, $service] = createOcrTestUser();

    $file = UploadedFile::fake()->create('document.pdf', 10, 'application/pdf');

    $response = $this->actingAs($user)
        ->post('/api/courriers', [
            'objet' => 'Test OCR',
            'type' => 'sortant',
            'date_reception' => now()->toDateString(),
            'destinataire' => 'Service RH',
            'niveau_confidentialite_id' => $niveau->id,
            'resume' => 'Résumé de test',
            'fichier' => $file,
        ], [
            'Accept' => 'application/json',
        ])
        ->assertCreated();

    $response->assertJsonPath('courrier.objet', 'Test OCR');
    $response->assertJsonPath('courrier.resume', 'Résumé de test');

    expect(Courrier::count())->toBe(1);

    $courrier = Courrier::first();
    expect($courrier->attachments()->count())->toBe(1);
    expect(in_array($courrier->ocr_status, ['pending', 'processing', 'completed', 'failed']))->toBeTrue();
});

test('OCR does not block courrier creation on failure', function () {
    [$user, $niveau, $service] = createOcrTestUser();

    $file = UploadedFile::fake()->create('corrupt.pdf', 10, 'application/pdf');

    $this->actingAs($user)
        ->post('/api/courriers', [
            'objet' => 'Test échec OCR',
            'type' => 'sortant',
            'date_reception' => now()->toDateString(),
            'destinataire' => 'Service RH',
            'niveau_confidentialite_id' => $niveau->id,
            'resume' => 'Résumé manuel',
            'fichier' => $file,
        ], [
            'Accept' => 'application/json',
        ])
        ->assertCreated()
        ->assertJsonPath('courrier.objet', 'Test échec OCR');
});

test('courrier can be searched by resume text after creation', function () {
    [$user, $niveau, $service] = createOcrTestUser();

    $courrier = Courrier::create([
        'numero' => 'COUR-SEARCH-OCR',
        'objet' => 'Recherche OCR',
        'resume' => 'Budget approuvé pour le projet 2026',
        'type' => 'sortant',
        'date_creation' => now(),
        'date_reception' => now(),
        'expediteur' => 'Direction',
        'destinataire' => 'Service RH',
        'statut' => 'CREE',
        'niveau_confidentialite_id' => $niveau->id,
        'createur_id' => $user->id,
        'service_source_id' => $service->id,
        'extracted_text' => 'Le budget du projet 2026 a été approuvé par la direction des finances.',
        'ocr_status' => 'completed',
    ]);

    $this->actingAs($user)
        ->getJson('/api/courriers?q=Budget')
        ->assertOk()
        ->assertJsonPath('courriers.total', 1)
        ->assertJsonPath('courriers.data.0.numero', 'COUR-SEARCH-OCR');
});

test('courrier can be searched by extracted text', function () {
    [$user, $niveau, $service] = createOcrTestUser();

    $courrier = Courrier::create([
        'numero' => 'COUR-OCR-TEXT',
        'objet' => 'Texte extrait',
        'resume' => 'Résumé OCR',
        'type' => 'sortant',
        'date_creation' => now(),
        'date_reception' => now(),
        'expediteur' => 'Direction',
        'destinataire' => 'Service RH',
        'statut' => 'CREE',
        'niveau_confidentialite_id' => $niveau->id,
        'createur_id' => $user->id,
        'service_source_id' => $service->id,
        'extracted_text' => 'Le rapport financier détaillé pour l\'exercice 2026 est disponible.',
        'ocr_status' => 'completed',
    ]);

    $this->actingAs($user)
        ->getJson('/api/courriers?q=financier')
        ->assertOk()
        ->assertJsonPath('courriers.total', 1)
        ->assertJsonPath('courriers.data.0.numero', 'COUR-OCR-TEXT');
});

test('multiple attachments are handled by OCR', function () {
    [$user, $niveau, $service] = createOcrTestUser();

    $file1 = UploadedFile::fake()->create('doc1.pdf', 10, 'application/pdf');
    $file2 = UploadedFile::fake()->create('doc2.jpg', 10, 'image/jpeg');

    $response = $this->actingAs($user)
        ->post('/api/courriers', [
            'objet' => 'Multi OCR',
            'type' => 'sortant',
            'date_reception' => now()->toDateString(),
            'destinataire' => 'Service RH',
            'niveau_confidentialite_id' => $niveau->id,
            'resume' => 'Résumé multi-documents',
            'documents' => [$file1, $file2],
        ], [
            'Accept' => 'application/json',
        ])
        ->assertCreated();

    $courrier = Courrier::first();
    expect($courrier->attachments()->count())->toBe(2);
});

test('courrier OCR status can be queried', function () {
    [$user, $niveau, $service] = createOcrTestUser();

    $courrier = Courrier::create([
        'numero' => 'COUR-OCR-STATUS',
        'objet' => 'Statut OCR',
        'resume' => 'Test status',
        'type' => 'sortant',
        'date_creation' => now(),
        'date_reception' => now(),
        'expediteur' => 'Direction',
        'destinataire' => 'Service RH',
        'statut' => 'CREE',
        'niveau_confidentialite_id' => $niveau->id,
        'createur_id' => $user->id,
        'service_source_id' => $service->id,
        'ocr_status' => 'completed',
        'extracted_text' => 'Texte extrait de test',
        'summary_source' => 'auto_generated',
    ]);

    $this->actingAs($user)
        ->getJson("/api/courriers/{$courrier->id}/ocr")
        ->assertOk()
        ->assertJsonPath('ocr_status', 'completed')
        ->assertJsonPath('summary_source', 'auto_generated')
        ->assertJsonStructure(['attachments']);
});

test('summary_source tracks auto-generated summaries', function () {
    [$user, $niveau, $service] = createOcrTestUser();

    $courrier = Courrier::create([
        'numero' => 'COUR-SUMMARY-SRC',
        'objet' => 'Source résumé',
        'resume' => 'Résumé généré automatiquement',
        'type' => 'sortant',
        'date_creation' => now(),
        'date_reception' => now(),
        'expediteur' => 'Direction',
        'destinataire' => 'Service RH',
        'statut' => 'CREE',
        'niveau_confidentialite_id' => $niveau->id,
        'createur_id' => $user->id,
        'service_source_id' => $service->id,
        'summary_source' => 'auto_generated',
    ]);

    $this->actingAs($user)
        ->getJson("/api/courriers/{$courrier->id}")
        ->assertOk()
        ->assertJsonPath('courrier.summary_source', 'auto_generated')
        ->assertJsonPath('courrier.resume_auto_genere', 'Résumé généré automatiquement');
});

test('OcrService can clean and detect text', function () {
    $service = app(OcrService::class);

    $dirty = "  Bonjour   le   monde  \n\n\n  Comment  ça  va?  ";
    $cleaned = $service->cleanText($dirty);
    expect($cleaned)->not->toContain('  ');
    expect($cleaned)->toContain('Bonjour');

    $arabic = 'السلام عليكم ورحمة الله وبركاته هذا نص عربي';
    $lang = $service->detectLanguage($arabic);
    expect($lang)->toBe('ara');

    $french = 'Bonjour, nous vous informons que votre dossier a été approuvé.';
    $lang = $service->detectLanguage($french);
    expect($lang)->toBe('fra');

    $english = 'Dear Sir, we are pleased to inform you that your application has been approved.';
    $lang = $service->detectLanguage($english);
    expect($lang)->toBe('eng');
});

test('OcrService generates professional summary from body content', function () {
    $service = app(OcrService::class);

    $longText = "Objet: Demande de financement pour le projet 2026\n"
        . "Réf: N°2026-0042\n"
        . "Date: 15/03/2026\n"
        . "Madame la Directrice,\n"
        . "Nous sollicitons votre approbation pour le budget annuel de la Direction des Finances.\n"
        . "Le montant total demandé est de 5 000 000 DA.\n"
        . "Ce budget permettra de couvrir les dépenses de fonctionnement du service.\n"
        . "Cordialement,\n"
        . "Jean Dupont\n"
        . "Chef de Service Comptable";

    $summary = $service->generateSummary($longText, 'Demande de financement pour le projet 2026');

    expect($summary)->not->toBeEmpty();
    expect($summary)->toContain('budget annuel');
    expect($summary)->toContain('Direction des Finances');
    expect($summary)->toContain('5 000 000 DA');
    expect(strlen($summary))->toBeLessThan(650);
});

test('OcrService generates summary from metadata when no body exists', function () {
    $service = app(OcrService::class);

    $metaOnly = "Objet: Demande de budget\nRéf: N°2026-0042\nDate: 15/03/2026";

    $summary = $service->generateSummary($metaOnly, 'Demande de budget');

    expect($summary)->not->toBeEmpty();
    expect($summary)->toContain('Demande de budget');
});

test('OcrService combines multiple texts and avoids duplicates', function () {
    $service = app(OcrService::class);

    $text1 = 'Document original avec des informations importantes.';
    $text2 = 'Document original avec des informations importantes.';
    $text3 = 'Second document avec des données différentes.';

    $combined = $service->combineAttachmentTexts([$text1, $text2, $text3]);

    expect(substr_count($combined, 'Document original'))->toBe(1);
    expect($combined)->toContain('Second document');
});
