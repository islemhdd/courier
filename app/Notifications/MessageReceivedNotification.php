<?php

namespace App\Notifications;

use App\Models\Message;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Notification;

class MessageReceivedNotification extends Notification implements ShouldBroadcast
{
    use Queueable;

    public function __construct(public Message $message) {}

    public function via($notifiable): array
    {
        return ['broadcast'];
    }

    public function toBroadcast($notifiable): BroadcastMessage
    {
        return new BroadcastMessage([
            'type' => 'message_received',
            'titre' => 'Nouveau message reçu',
            'message' => 'Vous avez reçu un nouveau message de ' . $this->message->emetteur->nom_complet,
            'message_id' => $this->message->id,
            'emetteur' => $this->message->emetteur->nom_complet,
            'objet' => $this->message->objet,
        ]);
    }
}
