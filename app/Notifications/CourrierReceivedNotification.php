<?php

namespace App\Notifications;

use App\Models\Courrier;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Notification;

class CourrierReceivedNotification extends Notification implements ShouldBroadcast
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
            'type' => 'courrier_received',
            'titre' => 'Nouveau courrier reçu',
            'message' => 'Un courrier a été reçu de ' . $this->courrier->expediteur . ' (' . $this->courrier->numero . ').',
            'courrier_numero' => $this->courrier->numero,
            'expediteur' => $this->courrier->expediteur,
            'courrier_id' => $this->courrier->id,
        ]);
    }
}
