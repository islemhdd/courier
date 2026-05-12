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
        return ['broadcast', 'database'];
    }

    public function toBroadcast($notifiable): BroadcastMessage
    {
        $canView = $notifiable->peutVoirCourrier($this->courrier);

        $data = [
            'type' => 'courrier_received',
            'titre' => 'Nouveau courrier reçu',
            'message' => 'Un nouveau courrier vous a été adressé.',
        ];

        if ($canView) {
            $data['message'] = 'Un courrier a été reçu de ' . ($this->courrier->expediteur ?? 'inconnu') . ' (' . ($this->courrier->numero ?? 'N/A') . ').';
            $data['courrier_id'] = $this->courrier->id;
        }

        return new BroadcastMessage($data);
    }

    public function toArray($notifiable): array
    {
        $canView = $notifiable->peutVoirCourrier($this->courrier);

        return [
            'type' => 'courrier_received',
            'titre' => 'Nouveau courrier reçu',
            'message' => $canView
                ? 'Un courrier a été reçu de ' . ($this->courrier->expediteur ?? 'inconnu') . ' (' . ($this->courrier->numero ?? 'N/A') . ').'
                : 'Un nouveau courrier vous a été adressé.',
            'courrier_id' => $canView ? $this->courrier->id : null,
            'courrier_numero' => $canView ? $this->courrier->numero : null,
        ];
    }
}
