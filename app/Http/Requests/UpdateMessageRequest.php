<?php

namespace App\Http\Requests;

use App\Models\Courrier;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;

class UpdateMessageRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        $message = $this->route('message');

        return $user !== null
            && $message !== null
            && $message->emetteur_id === $user->id;
    }

    public function rules(): array
    {
        return [
            'destinataire_id' => ['sometimes', 'integer', 'exists:users,id'],
            'contenu' => ['required', 'string'],
            'courrier_id' => ['nullable', 'integer', 'exists:courriers,id'],
        ];
    }

    public function messages(): array
    {
        return [
            'destinataire_id.integer' => 'L\'identifiant du destinataire doit être un entier.',
            'destinataire_id.exists' => 'Le destinataire sélectionné n\'existe pas.',
            'contenu.required' => 'Le contenu du message est obligatoire.',
            'courrier_id.integer' => 'L\'identifiant du courrier doit être un entier.',
            'courrier_id.exists' => 'Le courrier sélectionné n\'existe pas.',
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $user = $this->user();
            $courrierId = $this->input('courrier_id');
            $message = $this->route('message');

            if (!$user || !$courrierId) {
                return;
            }

            $courrier = Courrier::with('niveauConfidentialite', 'createur')->find($courrierId);

            if (!$courrier) {
                return;
            }

            // Vérifier que l'expéditeur peut voir ce courrier
            if (!$courrier->peutEtreConsultePar($user)) {
                $validator->errors()->add(
                    'courrier_id',
                    'Vous n\'avez pas le droit de référencer ce courrier.'
                );
                return;
            }

            // Vérifier que le destinataire peut aussi voir ce courrier
            $destinataireId = $this->input('destinataire_id', $message?->destinataire_id);
            if ($destinataireId) {
                $destinataire = User::find($destinataireId);
                if ($destinataire && !$courrier->peutEtreConsultePar($destinataire)) {
                    $validator->errors()->add(
                        'courrier_id',
                        'Le destinataire n\'a pas l\'autorisation de consulter le courrier référencé.'
                    );
                }
            }
        });
    }
}
