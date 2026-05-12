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
        return ['broadcast', 'database'];
    }

    public function toBroadcast($notifiable): BroadcastMessage
    {
        return new BroadcastMessage([
            'type' => 'validation_requested',
            'titre' => 'Demande de validation',
            'message' => 'Un courrier est en attente de validation.',
            'courrier_id' => $this->courrier->id,
            'courrier_numero' => $this->courrier->numero,
        ]);
    }

    public function toArray($notifiable): array
    {
        return [
            'type' => 'validation_requested',
            'titre' => 'Demande de validation',
            'message' => 'Un courrier est en attente de validation.',
            'courrier_id' => $this->courrier->id,
            'courrier_numero' => $this->courrier->numero,
        ];
    }
}
