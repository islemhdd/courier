<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class UpdateStructureRequest extends FormRequest
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
        $structure = $this->route('structure');

        return [
            'libelle' => ['required', 'string', 'max:120', 'unique:structures,libelle,' . $structure?->id],
            'description' => ['nullable', 'string', 'max:2000'],
        ];
    }

    public function messages(): array
    {
        return [
            'libelle.required' => 'Le libellé de la structure est requis.',
            'libelle.unique' => 'Ce libellé est déjà utilisé par une autre structure.',
        ];
    }
}
