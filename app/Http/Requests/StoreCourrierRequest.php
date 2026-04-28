<?php

namespace App\Http\Requests;

use App\Models\NiveauConfidentialite;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Requête de validation pour la création d'un courrier.
 */
class StoreCourrierRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user && ($user->estAdmin() || $user->estSecretaire());
    }

    public function rules(): array
    {
        return [
            'objet' => ['required', 'string', 'max:100'],
            'type' => ['required', 'in:entrant,sortant'],

            'expediteur' => ['nullable', 'string', 'max:100'],
            'destinataire' => ['nullable', 'string', 'max:100'],

            'date_reception' => ['required', 'date'],
            'niveau_confidentialite_id' => [
                'required',
                'integer',
                'exists:niveau_confidentialites,id',
            ],

            'fichier' => [
                'nullable',
                'file',
                'mimes:pdf,doc,docx,jpg,jpeg,png',
                'max:10240',
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'objet.required' => 'L’objet est obligatoire.',
            'type.required' => 'Le type du courrier est obligatoire.',
            'type.in' => 'Le type doit être entrant ou sortant.',
            'date_reception.required' => 'La date est obligatoire.',
            'niveau_confidentialite_id.required' => 'Le niveau de confidentialité est obligatoire.',
            'niveau_confidentialite_id.exists' => 'Le niveau de confidentialité sélectionné est invalide.',
            'fichier.mimes' => 'Le fichier doit être PDF, Word ou image.',
            'fichier.max' => 'Le fichier ne doit pas dépasser 10 Mo.',
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $user = $this->user();

            if (!$user) {
                $validator->errors()->add(
                    'niveau_confidentialite_id',
                    'Vous devez être connecté pour créer un courrier.'
                );
                return;
            }

            $niveauId = $this->input('niveau_confidentialite_id');

            if (!$niveauId) {
                return;
            }

            $niveauChoisi = NiveauConfidentialite::find($niveauId);
            $niveauUser = $user->niveauConfidentialite;

            if ($niveauChoisi && $niveauUser && $niveauChoisi->rang > $niveauUser->rang) {
                $validator->errors()->add(
                    'niveau_confidentialite_id',
                    'Vous ne pouvez pas choisir un niveau de confidentialité supérieur au vôtre.'
                );
            }
        });
    }

    protected function prepareForValidation(): void
    {
        if (!$this->has('numero')) {
            $annee = date('Y');
            $random = strtoupper(substr(uniqid(), -8));

            $this->merge([
                'numero' => 'COUR-' . $annee . '-' . $random,
            ]);
        }
    }
}