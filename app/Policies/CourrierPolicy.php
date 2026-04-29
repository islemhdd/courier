<?php

namespace App\Policies;

use App\Models\Courrier;
use App\Models\User;

/**
 * Policy pour la gestion des courriers.
 * Définit les autorisations pour les actions sur les courriers.
 */
class CourrierPolicy
{
    /**
     * Détermine si l'utilisateur peut voir la liste des courriers.
     * Tout utilisateur authentifié peut voir la liste (avec filtres appliqués).
     */
    public function viewAny(User $user): bool
    {
        return true;
    }

    /**
     * Détermine si l'utilisateur peut voir les détails d'un courrier.
     *
     * Règles :
     * - admin : toujours vrai
     * - chef : si le créateur est dans son service ET le niveau de confidentialité est ≤ au sien
     * - secretaire : si c'est son courrier OU le niveau de confidentialité est ≤ au sien
     */
    public function view(User $user, Courrier $courrier): bool
    {
        return $courrier->peutVoirExistencePar($user);
    }

    /**
     * Détermine si l'utilisateur peut créer un courrier.
     * Admin et secretaire peuvent créer.
     */
    public function create(User $user): bool
    {
        return $user->estAdmin() || $user->estSecretaire();
    }

    /**
     * Détermine si l'utilisateur peut modifier un courrier.
     * Seul le créateur ou l'admin peut modifier.
     */
    public function update(User $user, Courrier $courrier): bool
    {
        if ($user->estAdmin()) {
            return true;
        }

        return $courrier->createur_id === $user->id;
    }

    /**
     * Détermine si l'utilisateur peut supprimer un courrier.
     * Seul le créateur ou l'admin peut supprimer.
     */
    public function delete(User $user, Courrier $courrier): bool
    {
        if ($user->estAdmin()) {
            return true;
        }

        return $courrier->createur_id === $user->id;
    }

    /**
     * Détermine si l'utilisateur peut archiver un courrier.
     * Admin et créateur peuvent archiver.
     */
    public function archiver(User $user, Courrier $courrier): bool
    {
        return $user->estAdmin() || $courrier->createur_id === $user->id;
    }

    /**
     * Détermine si l'utilisateur peut valider un courrier.
     * Le chef dont le service correspond au créateur peut valider.
     */
    public function valider(User $user, Courrier $courrier): bool
    {
        if (!$user->estChef() && !$user->estAdmin()) {
            return false;
        }

        if (!$courrier->estValidable()) {
            return false;
        }

        if ($user->estAdmin()) {
            return true;
        }

        if (!$courrier->createur || $courrier->createur_id === $user->id) {
            return false;
        }

        return $courrier->createur->service_id === $user->service_id;
    }
}
