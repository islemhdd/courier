<?php

namespace App\Policies;

use App\Models\User;

class UserPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->peutConsulterUtilisateurs();
    }

    public function view(User $user, User $model): bool
    {
        return $user->peutGererUtilisateur($model) || $user->id === $model->id;
    }

    public function create(User $user): bool
    {
        return $user->peutConsulterUtilisateurs();
    }

    public function update(User $user, User $model): bool
    {
        return $user->peutGererUtilisateur($model);
    }

    public function delete(User $user, User $model): bool
    {
        return $user->id !== $model->id && $user->peutGererUtilisateur($model);
    }
}
