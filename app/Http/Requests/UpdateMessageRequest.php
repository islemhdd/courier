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
            'contenu' => ['required', 'string'],
            'courrier_id' => ['nullable', 'integer', 'exists:courriers,id'],
        ];
    }

    public function messages(): array
    {
        return [
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

            if (!$user || !$courrierId) {
                return;
            }

            $courrier = Courrier::with('niveauConfidentialite', 'createur')->find($courrierId);

            if (!$courrier) {
                return;
            }

            if (!$this->userPeutVoirCourrier($user, $courrier)) {
                $validator->errors()->add(
                    'courrier_id',
                    'Vous n\'avez pas le droit de référencer ce courrier.'
                );
            }
        });
    }

    private function userPeutVoirCourrier(User $user, Courrier $courrier): bool
    {
        return $courrier->peutEtreVuEnDetailPar($user);
    }
}
