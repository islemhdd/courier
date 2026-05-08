<?php

namespace App\Notifications;

use App\Models\Courrier;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Notification;

class CourrierReponduNotification extends Notification implements ShouldBroadcast
{
    use Queueable;

    public function __construct(public Courrier $courrier) {}

    public function via($notifiable): array
    {
        return ['broadcast'];
    }

    public function toBroadcast($notifiable): BroadcastMessage
    {
        return new BroadcastMessage([
            'type' => 'courrier_repondu',
            'titre' => 'Courrier répondu',
            'message' => 'Une réponse a été ajoutée au courrier ' . $this->courrier->parent->numero . '.',
            'parent_numero' => $this->courrier->parent->numero,
            'parent_id' => $this->courrier->parent->id,
            'reply_numero' => $this->courrier->numero,
            'reply_id' => $this->courrier->id,
            'expediteur' => $this->courrier->createur->nom_complet,
        ]);
    }
}
