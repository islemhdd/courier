<?php

namespace App\Policies;

use App\Models\Service;
use App\Models\User;

class ServicePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->estAdmin();
    }

    public function view(User $user, Service $service): bool
    {
        return $user->estAdmin();
    }

    public function create(User $user): bool
    {
        return $user->estAdmin();
    }

    public function update(User $user, Service $service): bool
    {
        return $user->estAdmin();
    }

    public function delete(User $user, Service $service): bool
    {
        return $user->estAdmin();
    }
}
