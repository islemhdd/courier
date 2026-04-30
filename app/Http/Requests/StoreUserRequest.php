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
            'service_id' => ['nullable', 'integer', 'exists:services,id'],
            'niveau_confidentialite_id' => ['nullable', 'integer', 'exists:niveau_confidentialites,id'],
        ];
    }
}
