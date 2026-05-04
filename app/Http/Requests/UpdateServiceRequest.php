<?php

namespace App\Http\Requests;

use App\Models\Service;
use Illuminate\Foundation\Http\FormRequest;

class UpdateServiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        $service = $this->route('service');

        return $user !== null && $service instanceof Service && $user->can('update', $service);
    }

    public function rules(): array
    {
        $service = $this->route('service');

        return [
            'libelle' => ['required', 'string', 'max:255', 'unique:services,libelle,' . $service?->id],
            'structure_id' => ['nullable', 'integer', 'exists:structures,id'],
        ];
    }
}
