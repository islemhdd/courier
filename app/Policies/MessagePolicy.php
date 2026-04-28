<?php

namespace App\Policies;

use App\Models\Message;
use App\Models\User;

/**
 * Policy pour la gestion des messages.
 * Définit les autorisations pour les actions sur les messages.
 */
class MessagePolicy
{
    /**
     * Détermine si l'utilisateur peut voir la liste des messages.
     * Tout utilisateur authentifié peut voir ses propres messages.
     */
    public function viewAny(User $user): bool
    {
        return true;
    }

    /**
     * Détermine si l'utilisateur peut voir les détails d'un message.
     * Seul l'émetteur ou le destinataire peut voir le message.
     */
    public function view(User $user, Message $message): bool
    {
        return $message->emetteur_id === $user->id || $message->destinataire_id === $user->id;
    }

    /**
     * Détermine si l'utilisateur peut créer un message.
     * Tout utilisateur authentifié peut envoyer un message.
     */
    public function create(User $user): bool
    {
        return true;
    }

    /**
     * Détermine si l'utilisateur peut supprimer un message.
     * Seul l'émetteur peut supprimer un message.
     */
    public function delete(User $user, Message $message): bool
    {
        return $message->emetteur_id === $user->id;
    }

    /**
     * Détermine si l'utilisateur peut marquer un message comme lu.
     * Seul le destinataire peut marquer un message comme lu.
     */
    public function markRead(User $user, Message $message): bool
    {
        return $message->destinataire_id === $user->id;
    }
}
