<?php

namespace App\Notifications;

use App\Models\Message;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Notification;

class MessageSentNotification extends Notification
{
    use Queueable;

    public function __construct(public Message $message)
    {}

    public function via($notifiable): array
    {
        if (app()->environment('testing')) {
            return [];
        }

        return ['broadcast'];
    }

    public function toBroadcast($notifiable): BroadcastMessage
    {
        return new BroadcastMessage([
            'type' => 'message_sent',
            'titre' => 'Nouveau message',
            'message' => 'Vous avez reçu un nouveau message de ' . $this->message->emetteur->nom_complet,
            'message_id' => $this->message->id,
            'emetteur' => $this->message->emetteur->nom_complet,
        ]);
    }
}
