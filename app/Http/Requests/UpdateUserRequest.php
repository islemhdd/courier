<?php

namespace App\Http\Requests;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class UpdateUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        $target = $this->route('user');

        return $user !== null && $target instanceof User && $user->can('update', $target);
    }

    public function rules(): array
    {
        $target = $this->route('user');

        return [
            'nom' => ['sometimes', 'required', 'string', 'max:255'],
            'prenom' => ['sometimes', 'required', 'string', 'max:255'],
            'email' => ['sometimes', 'required', 'email', 'max:255', 'unique:users,email,' . $target?->id],
            'password' => ['nullable', 'confirmed', Password::defaults()],
            'actif' => ['sometimes', 'boolean'],
            'role' => ['sometimes', 'required', 'in:' . implode(',', User::ROLES)],
            'role_scope' => ['sometimes', 'in:general,structure,service'],
            'service_id' => ['sometimes', 'nullable', 'integer', 'exists:services,id'],
            'structure_id' => ['sometimes', 'nullable', 'integer', 'exists:structures,id'],
            'niveau_confidentialite_id' => ['sometimes', 'nullable', 'integer', 'exists:niveau_confidentialites,id'],
        ];
    }

    public function withValidator($validator): void
    {
        $target = $this->route('user');

        $validator->after(function ($validator) use ($target) {
            $data = $validator->getData();

            $role = $data['role'] ?? $target?->role;
            $scope = $data['role_scope'] ?? $target?->role_scope;

            if ($role === User::ROLE_CHEF && $scope === User::SCOPE_STRUCTURE) {
                $structureId = $data['structure_id'] ?? $target?->structure_id;

                if (!empty($structureId)) {
                    $exists = User::query()
                        ->where('role', User::ROLE_CHEF)
                        ->where('role_scope', User::SCOPE_STRUCTURE)
                        ->where('structure_id', $structureId)
                        ->when($target, fn($q) => $q->whereKeyNot($target->id))
                        ->exists();

                    if ($exists) {
                        $validator->errors()->add('structure_id', 'Un chef est déjà attribué à cette structure.');
                    }
                }
            }

            if ($role === User::ROLE_CHEF && $scope === User::SCOPE_SERVICE) {
                $serviceId = $data['service_id'] ?? $target?->service_id;

                if (!empty($serviceId)) {
                    $exists = User::query()
                        ->where('role', User::ROLE_CHEF)
                        ->where('role_scope', User::SCOPE_SERVICE)
                        ->where('service_id', $serviceId)
                        ->when($target, fn($q) => $q->whereKeyNot($target->id))
                        ->exists();

                    if ($exists) {
                        $validator->errors()->add('service_id', 'Un chef est déjà attribué à ce service.');
                    }
                }
            }
        });
    }
}
