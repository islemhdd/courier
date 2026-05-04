<?php

namespace App\Http\Requests;

use App\Models\Courrier;
use App\Models\NiveauConfidentialite;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateCourrierRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        $courrier = $this->route('courrier');

        return $user !== null && $courrier !== null && $courrier->peutEtreModifiePar($user);
    }

    public function rules(): array
    {
        return [
            'objet' => ['sometimes', 'required', 'string', 'max:100'],
            'type' => ['sometimes', 'required', Rule::in([Courrier::TYPE_ENTRANT, Courrier::TYPE_SORTANT])],
            'courrier_type_id' => ['sometimes', 'nullable', 'integer', 'exists:courrier_types,id'],
            'resume' => ['sometimes', 'required', 'string'],
            'date_reception' => ['sometimes', 'required', 'date'],
            'expediteur' => ['sometimes', 'nullable', 'string', 'max:100'],
            'destinataire' => ['sometimes', 'nullable', 'string', 'max:100'],
            'niveau_confidentialite_id' => ['sometimes', 'required', 'integer', 'exists:niveau_confidentialites,id'],
            'source_id' => ['sometimes', 'nullable', 'integer', 'exists:sources,id'],
            'parent_courrier_id' => ['sometimes', 'nullable', 'integer', 'exists:courriers,id'],
            'requiert_reponse' => ['sometimes', 'boolean'],
            'delai_reponse_jours' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'mode_diffusion' => ['sometimes', Rule::in(['unicast', 'multicast', 'broadcast'])],
            'service_source_id' => ['sometimes', 'nullable', 'integer', 'exists:services,id'],
            'service_destinataire_id' => ['sometimes', 'nullable', 'integer', 'exists:services,id'],
            'concerned_user_ids' => ['sometimes', 'array'],
            'concerned_user_ids.*' => ['integer', 'exists:users,id'],
            'recipients' => ['sometimes', 'array'],
            'recipients.*.recipient_type' => ['required_with:recipients', Rule::in(['structure', 'service', 'user', 'all'])],
            'recipients.*.structure_id' => ['nullable', 'integer', 'exists:structures,id'],
            'recipients.*.service_id' => ['nullable', 'integer', 'exists:services,id'],
            'recipients.*.user_id' => ['nullable', 'integer', 'exists:users,id'],
            'instructions' => ['sometimes', 'array'],
            'instructions.*.instruction_id' => ['nullable', 'integer', 'exists:instructions,id'],
            'instructions.*.commentaire' => ['nullable', 'string'],
            'instructions.*.validation_requise' => ['sometimes', 'boolean'],
            'documents' => ['sometimes', 'array'],
            'documents.*' => ['file', 'mimes:pdf,doc,docx,jpg,jpeg,png', 'max:10240'],
            'fichier' => ['nullable', 'file', 'mimes:pdf,doc,docx,jpg,jpeg,png', 'max:10240'],
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
            if ($niveauId) {
                $niveauChoisi = NiveauConfidentialite::find($niveauId);
                if ($niveauChoisi && $niveauChoisi->rang > $user->getRangNiveauConfidentialite()) {
                    $validator->errors()->add(
                        'niveau_confidentialite_id',
                        'Vous ne pouvez pas choisir un niveau de confidentialite superieur au votre.'
                    );
                }
            }
        });
    }
}
