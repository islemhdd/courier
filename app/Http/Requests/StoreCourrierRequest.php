<?php

namespace App\Http\Requests;

use App\Models\NiveauConfidentialite;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Requête de validation pour la création d'un courrier.
 * Vérifie les champs saisis et la règle de confidentialité.
 */
class StoreCourrierRequest extends FormRequest
{
    /**
     * Détermine si l'utilisateur est autorisé à faire cette requête.
     */
    public function authorize(): bool
    {
        // L'utilisateur doit être admin ou secretaire
        $user = $this->user();
        return $user && ($user->estAdmin() || $user->estSecretaire());
    }

    /**
     * Récupère les règles de validation.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'objet' => ['required', 'string', 'max:100'],
            'type' => ['required', 'string', 'max:20', Rule::in(['entrant', 'sortant'])],
            'date_reception' => ['required', 'date'],
            'expediteur' => ['required', 'string', 'max:100'],
            'niveau_confidentialite_id' => ['required', 'integer', 'exists:niveau_confidentialites,id'],
            'fichier' => ['nullable', 'file', 'mimes:pdf,doc,docx,jpg,jpeg,png', 'max:10240'],
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
            'expediteur.max' => 'L\'expéditeur ne peut pas dépasser 100 caractères.',
            'niveau_confidentialite_id.required' => 'Le niveau de confidentialité est obligatoire.',
            'niveau_confidentialite_id.exists' => 'Le niveau de confidentialité sélectionné n\'existe pas.',
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
                $validator->errors()->add('niveau_confidentialite_id', 'Vous devez être connecté pour créer un courrier.');
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

    /**
     * Prépare les données avant la validation.
     */
    protected function prepareForValidation(): void
    {
        // Générer le numéro de courrier automatiquement
        if (!$this->has('numero')) {
            $annee = date('Y');
            $caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            $random = '';
            for ($i = 0; $i < 8; $i++) {
                $random .= $caracteres[rand(0, strlen($caracteres) - 1)];
            }
            $this->merge(['numero' => 'COUR-' . $annee . '-' . $random]);
        }
    }
}
