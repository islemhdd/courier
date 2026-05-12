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
        return ['broadcast', 'database'];
    }

    public function toBroadcast($notifiable): BroadcastMessage
    {
        $canView = $notifiable->peutVoirCourrier($this->courrier);

        $data = [
            'type' => 'courrier_repondu',
            'titre' => 'Courrier répondu',
            'message' => 'Une réponse a été ajoutée à un courrier.',
        ];

        if ($canView) {
            $data['message'] = 'Une réponse a été ajoutée au courrier ' . ($this->courrier->parent->numero ?? 'N/A') . '.';
            $data['reply_id'] = $this->courrier->id;
        }

        return new BroadcastMessage($data);
    }

    public function toArray($notifiable): array
    {
        $canView = $notifiable->peutVoirCourrier($this->courrier);

        return [
            'type' => 'courrier_repondu',
            'titre' => 'Courrier répondu',
            'message' => $canView
                ? 'Une réponse a été ajoutée au courrier ' . ($this->courrier->parent->numero ?? 'N/A') . '.'
                : 'Une réponse a été ajoutée à un courrier.',
            'reply_id' => $canView ? $this->courrier->id : null,
            'parent_id' => $this->courrier->parent_courrier_id,
        ];
    }
}
