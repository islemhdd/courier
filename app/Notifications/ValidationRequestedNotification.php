<?php

namespace App\Notifications;

use App\Models\Courrier;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Notification;

class ValidationRequestedNotification extends Notification implements ShouldBroadcast
{
    use Queueable;

    public function __construct(public Courrier $courrier)
    {}

    public function via($notifiable): array
    {
        return ['broadcast'];
    }

    public function toBroadcast($notifiable): BroadcastMessage
    {
        return new BroadcastMessage([
            'type' => 'validation_requested',
            'titre' => 'Demande de validation',
            'message' => 'Le courrier ' . $this->courrier->numero . ' est en attente de validation.',
            'courrier_numero' => $this->courrier->numero,
            'createur' => $this->courrier->createur->nom_complet,
            'courrier_id' => $this->courrier->id,
        ]);
    }
}
