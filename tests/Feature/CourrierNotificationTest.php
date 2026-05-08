<?php

namespace Tests\Feature;

use App\Models\Courrier;
use App\Models\NiveauConfidentialite;
use App\Models\User;
use App\Notifications\CourrierReceivedNotification;
use App\Notifications\CourrierReponduNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class CourrierNotificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_courrier_received_notification_is_sent_when_transmitting_courrier(): void
    {
        Notification::fake();

        /** @var User $sender */
        $sender = User::factory()->create([
            'role' => User::ROLE_ADMIN,
            'role_scope' => User::SCOPE_GENERAL,
        ]);

        /** @var User $recipient */
        $recipient = User::factory()->create([
            'role' => User::ROLE_ADMIN,
            'role_scope' => User::SCOPE_GENERAL,
        ]);

        $niveau = NiveauConfidentialite::create([
            'libelle' => 'Normal',
            'rang' => 1,
        ]);

        $courrier = Courrier::create([
            'objet' => 'Transmettre test',
            'type' => Courrier::TYPE_SORTANT,
            'resume' => 'Résumé du courrier',
            'expediteur' => 'Service Expéditeur',
            'date_reception' => now(),
            'mode_diffusion' => 'unicast',
            'statut' => Courrier::STATUT_VALIDE,
            'service_source_id' => null,
            'service_destinataire_id' => null,
            'niveau_confidentialite_id' => $niveau->id,
            'createur_id' => $sender->id,
        ]);

        $courrier->recipients()->create([
            'recipient_type' => 'user',
            'user_id' => $recipient->id,
        ]);

        $this->actingAs($sender, 'sanctum')
            ->patchJson("/api/courriers/{$courrier->id}/transmettre", [
                'recipients' => [
                    ['recipient_type' => 'user', 'user_id' => $recipient->id],
                ],
                'mode_diffusion' => 'unicast',
            ])
            ->assertOk();

        Notification::assertSentTo($recipient, CourrierReceivedNotification::class);
    }

    public function test_courrier_repondu_notification_is_sent_to_concerned_users_when_reply_created(): void
    {
        Notification::fake();

        /** @var User $sender */
        $sender = User::factory()->create([
            'role' => User::ROLE_ADMIN,
            'role_scope' => User::SCOPE_GENERAL,
        ]);

        /** @var User $concerned */
        $concerned = User::factory()->create([
            'role' => User::ROLE_ADMIN,
            'role_scope' => User::SCOPE_GENERAL,
        ]);

        $niveau = NiveauConfidentialite::create([
            'libelle' => 'Normal',
            'rang' => 1,
        ]);

        $parent = Courrier::create([
            'objet' => 'Courrier parent',
            'type' => Courrier::TYPE_SORTANT,
            'resume' => 'Résumé parent',
            'expediteur' => 'Service Expéditeur',
            'date_reception' => now(),
            'mode_diffusion' => 'unicast',
            'statut' => Courrier::STATUT_VALIDE,
            'service_source_id' => null,
            'service_destinataire_id' => null,
            'niveau_confidentialite_id' => $niveau->id,
            'createur_id' => $sender->id,
        ]);

        $parent->concernedPeople()->attach($concerned->id);

        $this->actingAs($sender, 'sanctum')
            ->postJson('/api/courriers', [
                'parent_courrier_id' => $parent->id,
                'objet' => 'Réponse au courrier',
                'resume' => 'Résumé de la réponse',
                'date_reception' => now()->toDateString(),
                'mode_diffusion' => 'multicast',
            ])
            ->assertCreated();

        Notification::assertSentTo($concerned, CourrierReponduNotification::class);
    }
}
