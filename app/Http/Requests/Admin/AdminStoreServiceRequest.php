<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class AdminStoreServiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null && $this->user()->estAdmin();
    }

    public function rules(): array
    {
        return [
            'libelle' => ['required', 'string', 'max:255', 'unique:services,libelle'],
            'structure_id' => ['required', 'integer', 'exists:structures,id'],
            'description' => ['nullable', 'string', 'max:2000'],
        ];
    }

    public function messages(): array
    {
        return [
            'libelle.required' => 'Le libellé du service est requis.',
            'libelle.unique' => 'Ce libellé est déjà utilisé par un autre service.',
            'structure_id.required' => 'Veuillez sélectionner une structure de rattachement.',
            'structure_id.exists' => 'La structure sélectionnée n\'existe pas.',
        ];
    }
}
