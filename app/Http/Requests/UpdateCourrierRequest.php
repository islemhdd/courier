<?php

namespace App\Http\Requests;

use App\Models\NiveauConfidentialite;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Requête de validation pour la mise à jour d'un courrier.
 * Vérifie les champs saisis et la règle de confidentialité.
 */
class UpdateCourrierRequest extends FormRequest
{
    /**
     * Détermine si l'utilisateur est autorisé à faire cette requête.
     */
    public function authorize(): bool
    {
        $user = $this->user();

        if (!$user) {
            return false;
        }

        // L'utilisateur doit être admin ou secretaire
        if (!$user->estAdmin() && !$user->estSecretaire()) {
            return false;
        }

        // Vérifier que le courrier existe
        $courrier = $this->route('courrier');

        if (!$courrier) {
            return false;
        }

        // Seul le créateur ou l'admin peut modifier
        return $courrier->createur_id === $user->id || $user->estAdmin();
    }

    /**
     * Récupère les règles de validation.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'objet' => ['sometimes', 'required', 'string', 'max:100'],
            'type' => ['sometimes', 'required', 'string', 'max:20', Rule::in(['entrant', 'sortant'])],
            'date_reception' => ['sometimes', 'required', 'date'],
            'expediteur' => ['sometimes', 'nullable', 'required_if:type,entrant', 'string', 'max:100'],
            'destinataire' => ['sometimes', 'nullable', 'required_if:type,sortant', 'string', 'max:100'],
            'niveau_confidentialite_id' => ['sometimes', 'required', 'integer', 'exists:niveau_confidentialites,id'],
            'fichier' => ['nullable', 'file', 'mimes:pdf,doc,docx,jpg,jpeg,png', 'max:10240'],
            'statut' => ['sometimes', 'string', Rule::in(['CREE', 'RECU', 'TRANSMIS', 'VALIDE', 'ARCHIVE'])],
        ];
    }

    /**
     * Messages d'erreur personnalisés.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'objet.required' => 'L\'objet du courrier est obligatoire.',
            'objet.max' => 'L\'objet ne peut pas dépasser 100 caractères.',
            'type.required' => 'Le type de courrier est obligatoire.',
            'type.in' => 'Le type doit être "entrant" ou "sortant".',
            'date_reception.required' => 'La date de réception est obligatoire.',
            'date_reception.date' => 'La date de réception doit être une date valide.',
            'expediteur.required' => 'L\'expéditeur est obligatoire.',
            'expediteur.required_if' => 'L\'expéditeur est obligatoire pour un courrier entrant.',
            'expediteur.max' => 'L\'expéditeur ne peut pas dépasser 100 caractères.',
            'destinataire.required_if' => 'Le destinataire est obligatoire pour un courrier sortant.',
            'destinataire.max' => 'Le destinataire ne peut pas dépasser 100 caractères.',
            'niveau_confidentialite_id.required' => 'Le niveau de confidentialité est obligatoire.',
            'niveau_confidentialite_id.exists' => 'Le niveau de confidentialité sélectionné n\'existe pas.',
            'statut.in' => 'Le statut doit être CREE, RECU, TRANSMIS, VALIDE ou ARCHIVE.',
            'fichier.file' => 'Le fichier doit être un fichier valide.',
            'fichier.mimes' => 'Le fichier doit être au format PDF, DOC, DOCX, JPG, JPEG ou PNG.',
            'fichier.max' => 'La taille du fichier ne peut pas dépasser 10 Mo.',
        ];
    }

    /**
     * Vérifie que le niveau de confidentialité choisi est inférieur ou égal
     * au niveau de l'utilisateur connecté.
     */
    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $user = $this->user();

            if (!$user) {
                return;
            }

            $niveauId = $this->input('niveau_confidentialite_id');

            if ($niveauId) {
                $niveauChoisi = NiveauConfidentialite::find($niveauId);
                $niveauUser = $user->niveauConfidentialite;

                if ($niveauChoisi && $niveauUser) {
                    if ($niveauChoisi->rang > $niveauUser->rang) {
                        $validator->errors()->add(
                            'niveau_confidentialite_id',
                            'Vous ne pouvez pas choisir un niveau de confidentialité supérieur au vôtre.'
                        );
                    }
                }
            }
        });
    }
}
