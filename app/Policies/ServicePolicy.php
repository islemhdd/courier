<?php

namespace App\Policies;

use App\Models\Service;
use App\Models\User;

class ServicePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->estAdmin() || $user->estChefGeneral() || $user->estChefStructure();
    }

    public function view(User $user, Service $service): bool
    {
        return $user->estAdmin()
            || $user->estChefGeneral()
            || ($user->estChefStructure() && $user->structure_id === $service->structure_id);
    }

    public function create(User $user): bool
    {
        return $user->estAdmin() || $user->estChefGeneral() || $user->estChefStructure();
    }

    public function update(User $user, Service $service): bool
    {
        return $user->estAdmin()
            || $user->estChefGeneral()
            || ($user->estChefStructure() && $user->structure_id === $service->structure_id);
    }

    public function delete(User $user, Service $service): bool
    {
        return $this->update($user, $service);
    }
}
