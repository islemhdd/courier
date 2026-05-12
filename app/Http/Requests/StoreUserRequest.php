<?php

namespace App\Http\Requests;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class StoreUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user !== null && $user->can('create', User::class);
    }

    public function rules(): array
    {
        return [
            'nom' => ['required', 'string', 'max:255'],
            'prenom' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'confirmed', Password::defaults()],
            'actif' => ['sometimes', 'boolean'],
            'role' => ['required', 'in:' . implode(',', User::ROLES)],
            'role_scope' => ['sometimes', 'in:general,structure,service'],
            'service_id' => ['nullable', 'integer', 'exists:services,id'],
            'structure_id' => ['nullable', 'integer', 'exists:structures,id'],
            'niveau_confidentialite_id' => ['nullable', 'integer', 'exists:niveau_confidentialites,id'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $data = $validator->getData();
            $role = $data['role'] ?? null;
            $scope = $data['role_scope'] ?? null;

            if ($role === User::ROLE_CHEF && $scope === User::SCOPE_STRUCTURE && !empty($data['structure_id'])) {
                $exists = User::query()
                    ->where('role', User::ROLE_CHEF)
                    ->where('role_scope', User::SCOPE_STRUCTURE)
                    ->where('structure_id', $data['structure_id'])
                    ->exists();

                if ($exists) {
                    $validator->errors()->add('structure_id', 'Un chef est déjà attribué à cette structure.');
                }
            }

            if ($role === User::ROLE_CHEF && $scope === User::SCOPE_SERVICE && !empty($data['service_id'])) {
                $exists = User::query()
                    ->where('role', User::ROLE_CHEF)
                    ->where('role_scope', User::SCOPE_SERVICE)
                    ->where('service_id', $data['service_id'])
                    ->exists();

                if ($exists) {
                    $validator->errors()->add('service_id', 'Un chef est déjà attribué à ce service.');
                }
            }
        });
    }
}
