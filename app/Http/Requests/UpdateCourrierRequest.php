<?php

namespace App\Http\Requests;

use App\Models\NiveauConfidentialite;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateCourrierRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        $courrier = $this->route('courrier');

        return $user !== null
            && $courrier !== null
            && $courrier->peutEtreModifiePar($user);
    }

    public function rules(): array
    {
        return [
            'objet' => ['sometimes', 'required', 'string', 'max:100'],
            'type' => ['sometimes', 'required', 'string', 'max:20', Rule::in(['entrant', 'sortant'])],
            'date_reception' => ['sometimes', 'required', 'date'],
            'expediteur' => ['sometimes', 'nullable', 'required_if:type,entrant', 'string', 'max:100'],
            'destinataire' => ['sometimes', 'nullable', 'required_if:type,sortant', 'string', 'max:100'],
            'niveau_confidentialite_id' => ['sometimes', 'required', 'integer', 'exists:niveau_confidentialites,id'],
            'service_destinataire_id' => ['sometimes', 'nullable', 'integer', 'exists:services,id'],
            'fichier' => ['nullable', 'file', 'mimes:pdf,doc,docx,jpg,jpeg,png', 'max:10240'],
            'statut' => ['sometimes', 'string', Rule::in(['CREE', 'VALIDE', 'TRANSMIS', 'RECU'])],
        ];
    }

    public function messages(): array
    {
        return [
            'objet.required' => 'L\'objet du courrier est obligatoire.',
            'objet.max' => 'L\'objet ne peut pas depasser 100 caracteres.',
            'type.required' => 'Le type de courrier est obligatoire.',
            'type.in' => 'Le type doit etre "entrant" ou "sortant".',
            'date_reception.required' => 'La date de reception est obligatoire.',
            'date_reception.date' => 'La date de reception doit etre une date valide.',
            'expediteur.required_if' => 'L\'expediteur est obligatoire pour un courrier entrant.',
            'expediteur.max' => 'L\'expediteur ne peut pas depasser 100 caracteres.',
            'destinataire.required_if' => 'Le destinataire est obligatoire pour un courrier sortant.',
            'destinataire.max' => 'Le destinataire ne peut pas depasser 100 caracteres.',
            'niveau_confidentialite_id.required' => 'Le niveau de confidentialite est obligatoire.',
            'niveau_confidentialite_id.exists' => 'Le niveau de confidentialite selectionne n\'existe pas.',
            'service_destinataire_id.exists' => 'Le service destinataire selectionne n\'existe pas.',
            'statut.in' => 'Le statut doit etre CREE, VALIDE, TRANSMIS ou RECU.',
            'fichier.file' => 'Le fichier doit etre un fichier valide.',
            'fichier.mimes' => 'Le fichier doit etre au format PDF, DOC, DOCX, JPG, JPEG ou PNG.',
            'fichier.max' => 'La taille du fichier ne peut pas depasser 10 Mo.',
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $user = $this->user();

            if (!$user) {
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
                    'Vous ne pouvez pas choisir un niveau de confidentialite superieur au votre.'
                );
            }
        });
    }
}
