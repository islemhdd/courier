<?php

namespace App\Http\Requests;

use App\Models\Courrier;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Requête de validation pour l'envoi d'un message.
 * Vérifie les champs saisis et les permissions liées au courrier.
 */
class StoreMessageRequest extends FormRequest
{
    /**
     * Détermine si l'utilisateur est autorisé à faire cette requête.
     */
    public function authorize(): bool
    {
        // Tout utilisateur authentifié peut envoyer un message
        return $this->user() !== null;
    }

    /**
     * Récupère les règles de validation.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'destinataire_id' => ['required', 'integer', 'exists:users,id'],
            'envoyer' => ['sometimes', 'boolean'],
            'contenu' => ['required', 'string'],
            'courrier_id' => ['nullable', 'integer', 'exists:courriers,id'],
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
            'destinataire_id.required' => 'Le destinataire est obligatoire.',
            'destinataire_id.integer' => 'L\'identifiant du destinataire doit être un entier.',
            'destinataire_id.exists' => 'Le destinataire sélectionné n\'existe pas.',
            'contenu.required' => 'Le contenu du message est obligatoire.',
            'courrier_id.integer' => 'L\'identifiant du courrier doit être un entier.',
            'courrier_id.exists' => 'Le courrier sélectionné n\'existe pas.',
        ];
    }

    /**
     * Vérifie que l'émetteur a le droit de consulter le courrier référencé.
     */
    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $user = $this->user();

            if (!$user) {
                return;
            }

            $courrierId = $this->input('courrier_id');

            if ($courrierId) {
                $courrier = Courrier::with('niveauConfidentialite', 'createur')->find($courrierId);

                if (!$courrier) {
                    return;
                }

                // Vérifier si l'utilisateur peut voir ce courrier
                $peutVoirCourrier = $this->userPeutVoirCourrier($user, $courrier);

                if (!$peutVoirCourrier) {
                    $validator->errors()->add(
                        'courrier_id',
                        'Vous n\'avez pas le droit de référencer ce courrier.'
                    );
                }
            }
        });
    }

    /**
     * Vérifie si l'utilisateur peut voir le courrier.
     * Utilise les mêmes règles que pour l'affichage du détail.
     */
    private function userPeutVoirCourrier(User $user, Courrier $courrier): bool
    {
        return $courrier->peutEtreVuEnDetailPar($user);
    }
}
