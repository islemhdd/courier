<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class UpdateServiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null && $this->user()->estAdmin();
    }

    protected function prepareForValidation(): void
    {
        if (!$this->has('libelle') && $this->has('nom')) {
            $this->merge([
                'libelle' => $this->input('nom'),
            ]);
        }
    }

    public function rules(): array
    {
        $service = $this->route('service');

        return [
            'libelle' => ['required', 'string', 'max:255', 'unique:services,libelle,' . $service?->id],
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
