<?php

namespace Tests\Feature;

use App\Models\Courrier;
use App\Models\NiveauConfidentialite;
use App\Models\Service;
use App\Models\User;
use App\Models\Message;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class MessageConfidentialityTest extends TestCase
{
    use DatabaseTransactions;

    private User $userA;
    private User $userB;
    private User $userC;
    private NiveauConfidentialite $niveauPublic;
    private NiveauConfidentialite $niveauSecret;

    protected function setUp(): void
    {
        parent::setUp();

        $this->niveauPublic = NiveauConfidentialite::create(['libelle' => 'Public', 'rang' => 1]);
        $this->niveauSecret = NiveauConfidentialite::create(['libelle' => 'Secret', 'rang' => 10]);

        $service1 = Service::create(['libelle' => 'Service 1']);
        $service2 = Service::create(['libelle' => 'Service 2']);

        $this->userA = User::factory()->create([
            'role' => 'chef',
            'role_scope' => 'service',
            'service_id' => $service1->id,
            'niveau_confidentialite_id' => $this->niveauSecret->id,
        ]);

        $this->userB = User::factory()->create([
            'role' => 'secretaire',
            'role_scope' => 'service',
            'service_id' => $service2->id,
            'niveau_confidentialite_id' => $this->niveauSecret->id,
        ]);

        $this->userC = User::factory()->create([
            'role' => 'secretaire',
            'role_scope' => 'service',
            'service_id' => $service2->id,
            'niveau_confidentialite_id' => $this->niveauPublic->id,
        ]);
    }

    /** @test */
    public function user_can_send_message_to_another_service_without_courrier()
    {
        $response = $this->actingAs($this->userA)
            ->postJson('/api/messages', [
                'destinataire_id' => $this->userB->id,
                'contenu' => 'Hello from another service',
            ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('messages', [
            'emetteur_id' => $this->userA->id,
            'destinataire_id' => $this->userB->id,
            'contenu' => 'Hello from another service',
        ]);
    }

    /** @test */
    public function auto_sending_is_forbidden()
    {
        $response = $this->actingAs($this->userA)
            ->postJson('/api/messages', [
                'destinataire_id' => $this->userA->id,
                'contenu' => 'Self message',
            ]);

        $response->assertStatus(422);
    }

    /** @test */
    public function message_with_courrier_is_allowed_if_both_can_see_it()
    {
        $courrier = Courrier::create([
            'objet' => 'Test Courrier',
            'type' => Courrier::TYPE_ENTRANT,
            'statut' => Courrier::STATUT_RECU,
            'date_reception' => now(),
            'expediteur' => 'External Org',
            'destinataire' => 'Internal Dept',
            'createur_id' => $this->userA->id,
            'service_source_id' => $this->userA->service_id,
            'structure_origine_id' => $this->userA->structure_id,
            'niveau_confidentialite_id' => $this->niveauPublic->id,
        ]);

        // Add userB as a recipient so they can see it
        $courrier->recipients()->create([
            'recipient_type' => 'user',
            'user_id' => $this->userB->id,
        ]);

        $response = $this->actingAs($this->userA)
            ->postJson('/api/messages', [
                'destinataire_id' => $this->userB->id,
                'contenu' => 'Ref to courrier',
                'courrier_id' => $courrier->id,
            ]);

        $response->assertStatus(201);
    }

    /** @test */
    public function message_with_courrier_is_forbidden_if_sender_cannot_see_it()
    {
        $courrier = Courrier::create([
            'objet' => 'Secret Courrier',
            'type' => Courrier::TYPE_ENTRANT,
            'statut' => Courrier::STATUT_RECU,
            'date_reception' => now(),
            'expediteur' => 'External Org',
            'destinataire' => 'Internal Dept',
            'createur_id' => $this->userB->id, // UserB is creator
            'service_source_id' => $this->userB->service_id,
            'structure_origine_id' => $this->userB->structure_id,
            'niveau_confidentialite_id' => $this->niveauSecret->id,
        ]);

        // UserA cannot see this courrier

        $response = $this->actingAs($this->userA)
            ->postJson('/api/messages', [
                'destinataire_id' => $this->userB->id,
                'contenu' => 'Illegal ref',
                'courrier_id' => $courrier->id,
            ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('courrier_id');
    }

    /** @test */
    public function message_with_courrier_is_forbidden_if_recipient_cannot_see_it()
    {
        $courrier = Courrier::create([
            'objet' => 'Private Courrier',
            'type' => Courrier::TYPE_ENTRANT,
            'statut' => Courrier::STATUT_RECU,
            'date_reception' => now(),
            'expediteur' => 'External Org',
            'destinataire' => 'Internal Dept',
            'createur_id' => $this->userA->id,
            'service_source_id' => $this->userA->service_id,
            'structure_origine_id' => $this->userA->structure_id,
            'niveau_confidentialite_id' => $this->niveauPublic->id,
        ]);

        // UserB cannot see it (not a recipient, not same service)

        $response = $this->actingAs($this->userA)
            ->postJson('/api/messages', [
                'destinataire_id' => $this->userB->id,
                'contenu' => 'Ref to invisible courrier',
                'courrier_id' => $courrier->id,
            ]);

        $response->assertStatus(422);
        $response->assertJsonFragment(['Le destinataire n\'a pas l\'autorisation de consulter le courrier référencé.']);
    }

    /** @test */
    public function message_with_courrier_is_forbidden_if_recipient_confidentiality_is_too_low()
    {
        $courrier = Courrier::create([
            'objet' => 'Secret Courrier',
            'type' => Courrier::TYPE_ENTRANT,
            'statut' => Courrier::STATUT_RECU,
            'date_reception' => now(),
            'expediteur' => 'External Org',
            'destinataire' => 'Internal Dept',
            'createur_id' => $this->userA->id,
            'service_source_id' => $this->userA->service_id,
            'structure_origine_id' => $this->userA->structure_id,
            'niveau_confidentialite_id' => $this->niveauSecret->id,
        ]);

        // UserC is in same service (if we added him) or we make him recipient
        $courrier->recipients()->create([
            'recipient_type' => 'user',
            'user_id' => $this->userC->id,
        ]);

        // Even if UserC is a recipient, his confidentiality level (Public=1) 
        // is lower than the courrier (Secret=10)

        $response = $this->actingAs($this->userA)
            ->postJson('/api/messages', [
                'destinataire_id' => $this->userC->id,
                'contenu' => 'Low level ref',
                'courrier_id' => $courrier->id,
            ]);

        $response->assertStatus(422);
        $response->assertJsonFragment(['Le destinataire n\'a pas l\'autorisation de consulter le courrier référencé.']);
    }

    /** @test */
    public function message_list_hides_courrier_details_if_user_loses_access()
    {
        $courrier = Courrier::create([
            'objet' => 'Shared Courrier',
            'type' => Courrier::TYPE_ENTRANT,
            'statut' => Courrier::STATUT_RECU,
            'date_reception' => now(),
            'expediteur' => 'External Org',
            'destinataire' => 'Internal Dept',
            'createur_id' => $this->userA->id,
            'service_source_id' => $this->userA->service_id,
            'structure_origine_id' => $this->userA->structure_id,
            'niveau_confidentialite_id' => $this->niveauPublic->id,
        ]);

        $courrier->recipients()->create([
            'recipient_type' => 'user',
            'user_id' => $this->userB->id,
        ]);

        // A sends to B with courrier ref
        $message = Message::create([
            'emetteur_id' => $this->userA->id,
            'destinataire_id' => $this->userB->id,
            'contenu' => 'Check this',
            'courrier_id' => $courrier->id,
            'statut' => Message::STATUT_ENVOYE,
            'date_envoi' => now(),
        ]);

        // User B can see it
        $this->actingAs($this->userB)
            ->getJson('/api/messages')
            ->assertJsonFragment(['numero' => $courrier->numero]);

        // Now change courrier confidentiality to Secret
        $courrier->update(['niveau_confidentialite_id' => $this->niveauSecret->id]);
        
        // Downgrade User B to Public
        $this->userB->update(['niveau_confidentialite_id' => $this->niveauPublic->id]);
        $this->userB->refresh();

        // User B should no longer see courrier details in message list
        $response = $this->actingAs($this->userB)->getJson('/api/messages');
        $response->assertJsonMissing(['numero' => $courrier->numero]);
        $response->assertJsonFragment(['courrier_accessible' => false]);
    }

    /** @test */
    public function cannot_modify_or_delete_sent_message()
    {
        $message = Message::create([
            'emetteur_id' => $this->userA->id,
            'destinataire_id' => $this->userB->id,
            'contenu' => 'Sent message',
            'statut' => Message::STATUT_ENVOYE,
            'date_envoi' => now(),
        ]);

        // Update attempt
        $this->actingAs($this->userA)
            ->patchJson("/api/messages/{$message->id}", ['contenu' => 'Hacked'])
            ->assertStatus(422);

        // Delete attempt
        $this->actingAs($this->userA)
            ->deleteJson("/api/messages/{$message->id}")
            ->assertStatus(422);
    }
}
