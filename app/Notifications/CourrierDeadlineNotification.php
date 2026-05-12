<?php

namespace App\Notifications;

use App\Models\Courrier;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Notification;

class CourrierDeadlineNotification extends Notification implements ShouldBroadcast
{
    use Queueable;

    public function __construct(
        public Courrier $courrier,
        public int $joursRestants,
    ) {}

    public function via($notifiable): array
    {
        return ['broadcast', 'database'];
    }

    public function toBroadcast($notifiable): BroadcastMessage
    {
        $message = $this->joursRestants <= 0
            ? 'Le courrier ' . ($this->courrier->numero ?? 'N/A') . ' est en retard de réponse !'
            : 'Le courrier ' . ($this->courrier->numero ?? 'N/A') . ' nécessite une réponse sous ' . $this->joursRestants . ' jour' . ($this->joursRestants > 1 ? 's' : '') . '.';

        return new BroadcastMessage([
            'type' => 'courrier_deadline',
            'titre' => $this->joursRestants <= 0 ? 'Délai dépassé' : 'Délai approche',
            'message' => $message,
            'courrier_id' => $this->courrier->id,
            'jours_restants' => $this->joursRestants,
            'date_limite' => $this->courrier->date_limite_reponse?->format('Y-m-d'),
            'courrier_numero' => $this->courrier->numero,
        ]);
    }

    public function toArray($notifiable): array
    {
        return [
            'type' => 'courrier_deadline',
            'titre' => $this->joursRestants <= 0 ? 'Délai dépassé' : 'Délai approche',
            'message' => $this->joursRestants <= 0
                ? 'Le courrier ' . ($this->courrier->numero ?? 'N/A') . ' est en retard de réponse !'
                : 'Le courrier ' . ($this->courrier->numero ?? 'N/A') . ' nécessite une réponse sous ' . $this->joursRestants . ' jour' . ($this->joursRestants > 1 ? 's' : '') . '.',
            'courrier_id' => $this->courrier->id,
            'jours_restants' => $this->joursRestants,
            'date_limite' => $this->courrier->date_limite_reponse?->format('Y-m-d'),
            'courrier_numero' => $this->courrier->numero,
        ];
    }
}
