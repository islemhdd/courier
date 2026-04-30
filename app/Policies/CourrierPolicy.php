<?php

namespace App\Policies;

use App\Models\Courrier;
use App\Models\User;

class CourrierPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Courrier $courrier): bool
    {
        return $courrier->peutVoirExistencePar($user);
    }

    public function create(User $user): bool
    {
        return $user->peutCreerCourrier();
    }

    public function update(User $user, Courrier $courrier): bool
    {
        return $courrier->peutEtreModifiePar($user);
    }

    public function delete(User $user, Courrier $courrier): bool
    {
        return $courrier->peutEtreSupprimePar($user);
    }

    public function archiver(User $user, Courrier $courrier): bool
    {
        return $courrier->peutEtreArchivePar($user);
    }

    public function transmettre(User $user, Courrier $courrier): bool
    {
        return $courrier->peutEtreTransmisPar($user);
    }

    public function valider(User $user, Courrier $courrier): bool
    {
        return $courrier->peutEtreValidePar($user);
    }

    public function nonValider(User $user, Courrier $courrier): bool
    {
        return $courrier->peutEtreNonValidePar($user);
    }
}
