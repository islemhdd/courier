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
}
