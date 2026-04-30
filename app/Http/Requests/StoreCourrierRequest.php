<?php

namespace App\Http\Requests;

use App\Models\Courrier;
use App\Models\NiveauConfidentialite;
use Illuminate\Foundation\Http\FormRequest;

class StoreCourrierRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user && $user->peutCreerCourrier();
    }

    public function rules(): array
    {
        return [
            'objet' => ['required', 'string', 'max:100'],
            'type' => ['required', 'in:entrant,sortant'],
            'expediteur' => ['nullable', 'string', 'max:100'],
            'destinataire' => ['nullable', 'string', 'max:100'],
            'date_reception' => ['required', 'date'],
            'niveau_confidentialite_id' => ['required', 'integer', 'exists:niveau_confidentialites,id'],
            'statut' => ['sometimes', 'string', 'in:' . implode(',', Courrier::STATUTS)],
            'transmission_directe' => ['sometimes', 'boolean'],
            'service_destinataire_id' => ['nullable', 'integer', 'exists:services,id'],
            'fichier' => ['nullable', 'file', 'mimes:pdf,doc,docx,jpg,jpeg,png', 'max:10240'],
        ];
    }

    public function messages(): array
    {
        return [
            'objet.required' => 'L\'objet est obligatoire.',
            'type.required' => 'Le type du courrier est obligatoire.',
            'type.in' => 'Le type doit etre entrant ou sortant.',
            'date_reception.required' => 'La date est obligatoire.',
            'niveau_confidentialite_id.required' => 'Le niveau de confidentialite est obligatoire.',
            'niveau_confidentialite_id.exists' => 'Le niveau de confidentialite selectionne est invalide.',
            'service_destinataire_id.exists' => 'Le service destinataire selectionne est invalide.',
            'fichier.mimes' => 'Le fichier doit etre PDF, Word ou image.',
            'fichier.max' => 'Le fichier ne doit pas depasser 10 Mo.',
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $user = $this->user();

            if (!$user) {
                $validator->errors()->add(
                    'niveau_confidentialite_id',
                    'Vous devez etre connecte pour creer un courrier.'
                );
                return;
            }

            $niveauId = $this->input('niveau_confidentialite_id');

            if ($niveauId) {
                $niveauChoisi = NiveauConfidentialite::find($niveauId);
                $niveauUser = $user->niveauConfidentialite;

                if ($niveauChoisi && $niveauUser && $niveauChoisi->rang > $niveauUser->rang) {
                    $validator->errors()->add(
                        'niveau_confidentialite_id',
                        'Vous ne pouvez pas choisir un niveau de confidentialite superieur au votre.'
                    );
                }
            }

            if (
                $this->input('type') === 'sortant'
                && !$this->filled('destinataire')
                && !$this->filled('service_destinataire_id')
            ) {
                $validator->errors()->add(
                    'destinataire',
                    'Veuillez choisir un service destinataire ou saisir un destinataire.'
                );
            }

            if ($this->input('type') === 'entrant' && !$this->filled('expediteur')) {
                $validator->errors()->add(
                    'expediteur',
                    'Veuillez saisir un expediteur pour un courrier recu.'
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
