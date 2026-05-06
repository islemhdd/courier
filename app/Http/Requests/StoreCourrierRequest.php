<?php

namespace App\Http\Requests;

use App\Models\Courrier;
use App\Models\NiveauConfidentialite;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCourrierRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        if (!$user) {
            return false;
        }

        if ($this->filled('parent_courrier_id')) {
            return true;
        }

        return $user->peutCreerCourrier();
    }

    public function rules(): array
    {
        $isReply = $this->filled('parent_courrier_id');

        return [
            'objet' => ['required', 'string', 'max:100'],
            'type' => [$isReply ? 'sometimes' : 'required', Rule::in([Courrier::TYPE_ENTRANT, Courrier::TYPE_SORTANT])],
            'courrier_type_id' => ['nullable', 'integer', 'exists:courrier_types,id'],
            'resume' => ['required', 'string'],
            'expediteur' => ['nullable', 'string', 'max:100'],
            'destinataire' => ['nullable', 'string', 'max:100'],
            'date_reception' => ['required', 'date'],
            'niveau_confidentialite_id' => [$isReply ? 'sometimes' : 'required', 'integer', 'exists:niveau_confidentialites,id'],
            'source_id' => [$isReply ? 'sometimes' : 'nullable', 'integer', 'exists:sources,id'],
            'source_libelle' => ['nullable', 'string', 'max:160'],
            'parent_courrier_id' => ['nullable', 'integer', 'exists:courriers,id'],
            'requiert_reponse' => ['sometimes', 'boolean'],
            'delai_reponse_jours' => ['nullable', 'integer', 'min:1'],
            'mode_diffusion' => ['required', Rule::in(['unicast', 'multicast', 'broadcast'])],
            'service_source_id' => ['nullable', 'integer', 'exists:services,id'],
            'service_destinataire_id' => ['nullable', 'integer', 'exists:services,id'],
            'concerned_user_ids' => ['sometimes', 'array'],
            'concerned_user_ids.*' => ['integer', 'exists:users,id'],
            'structure_origine_id' => ['nullable', 'integer', 'exists:structures,id'],
            'structure_destinataire_id' => ['nullable', 'integer', 'exists:structures,id'],
            'recipients' => ['nullable', 'array'],
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
            $isReply = $this->filled('parent_courrier_id');

            if (!$user) {
                return;
            }

            // Pour les réponses, on ne valide pas le niveau de confidentialité car il est forcé depuis le parent
            if (!$isReply) {
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
            }

            if ($this->boolean('requiert_reponse') && !$this->filled('delai_reponse_jours')) {
                $validator->errors()->add('delai_reponse_jours', 'Le delai de reponse est obligatoire.');
            }

            if (
                $this->input('type') === Courrier::TYPE_ENTRANT
                && !$user->estAdmin()
                && !$user->estChefGeneral()
                && !$user->estSecretaireGeneral()
            ) {
                $validator->errors()->add(
                    'type',
                    'Les courriers recus doivent etre saisis par le secretariat general ou valides au niveau general.'
                );
            }

            if (
                $this->input('type') === Courrier::TYPE_ENTRANT
                && !$this->hasFile('fichier')
                && !$this->hasFile('documents')
            ) {
                $validator->errors()->add('fichier', 'Le fichier est obligatoire pour un courrier recu.');
            }

            if (
                $this->input('type') === Courrier::TYPE_ENTRANT
                && $this->filled('expediteur')
                && $this->filled('service_source_id')
            ) {
                $validator->errors()->add(
                    'expediteur',
                    'Choisissez soit un expediteur, soit un service expediteur, pas les deux.'
                );
            }

            if (
                $this->input('type') === Courrier::TYPE_ENTRANT
                && !$this->filled('expediteur')
                && !$this->filled('service_source_id')
                && !$this->filled('source_id')
                && !$this->filled('source_libelle')
            ) {
                $validator->errors()->add(
                    'expediteur',
                    'Veuillez saisir un expediteur ou choisir un service expediteur pour un courrier recu.'
                );
            }

            // Pour les réponses, les destinataires sont automatiquement définis, pas besoin de les valider
            if (!$isReply && $this->input('mode_diffusion') !== 'broadcast' && empty($this->input('recipients')) && !$this->filled('destinataire') && !$this->filled('service_destinataire_id')) {
                $validator->errors()->add('recipients', 'Au moins un destinataire est obligatoire.');
            }

            // Pour les réponses, pas de validation des destinataires (automatiques)
            if (!$isReply) {
                if (
                    $this->input('mode_diffusion') === 'unicast'
                    && empty($this->input('recipients'))
                    && !($this->filled('destinataire') || $this->filled('service_destinataire_id'))
                ) {
                    $validator->errors()->add('recipients', 'Le mode unicast exige un seul destinataire.');
                }

                if (
                    $this->input('mode_diffusion') === 'unicast'
                    && !empty($this->input('recipients'))
                    && count($this->input('recipients', [])) !== 1
                ) {
                    $validator->errors()->add('recipients', 'Le mode unicast exige un seul destinataire.');
                }
            }

            $recipients = $this->input('recipients', []);
            $modeDiffusion = $this->input('mode_diffusion');

            // Pour les réponses, pas de validation des modes de diffusion (toujours unicast automatique)
            if (!$isReply) {
                if ($modeDiffusion === 'broadcast' && !empty($recipients)) {
                    $invalidBroadcastRecipients = collect($recipients)->filter(fn($recipient) => ($recipient['recipient_type'] ?? null) !== 'all')->isNotEmpty();
                    if ($invalidBroadcastRecipients) {
                        $validator->errors()->add('recipients', 'Le mode broadcast doit viser tout le monde.');
                    }
                }

                if ($modeDiffusion === 'multicast' && count($recipients) < 2) {
                    $validator->errors()->add('recipients', 'Le mode multicast exige plusieurs destinataires.');
                }
            }

            if ($this->filled('source_libelle') && !$user->peutAjouterSource()) {
                $validator->errors()->add(
                    'source_libelle',
                    'Seul le chef general ou son secretaire peut ajouter une nouvelle source.'
                );
            }

            foreach ($this->input('instructions', []) as $index => $instruction) {
                if (empty($instruction['instruction_id']) && empty($instruction['commentaire'])) {
                    $validator->errors()->add(
                        "instructions.$index.commentaire",
                        'Une instruction inconnue doit etre attachee comme commentaire.'
                    );
                }
            }

            // Pour les réponses, pas de validation des destinataires individuels (automatiques)
            if (!$isReply) {
                foreach ($this->input('recipients', []) as $index => $recipient) {
                    $type = $recipient['recipient_type'] ?? null;

                    if ($type === 'structure' && empty($recipient['structure_id'])) {
                        $validator->errors()->add("recipients.$index.structure_id", 'La structure destinataire est obligatoire.');
                    }

                    if ($type === 'service' && empty($recipient['service_id'])) {
                        $validator->errors()->add("recipients.$index.service_id", 'Le service destinataire est obligatoire.');
                    }

                    if ($type === 'user' && empty($recipient['user_id'])) {
                        $validator->errors()->add("recipients.$index.user_id", 'La personne destinataire est obligatoire.');
                    }
                }
            }

            if ($this->filled('parent_courrier_id')) {
                $parent = Courrier::find($this->input('parent_courrier_id'));
                if ($parent && $parent->requiert_reponse && $parent->date_limite_reponse && now()->greaterThan($parent->date_limite_reponse)) {
                    return;
                }
            }
        });
    }

    protected function prepareForValidation(): void
    {
        if (!$this->filled('resume') && $this->filled('objet')) {
            $this->merge(['resume' => $this->input('objet')]);
        }

        if (!$this->filled('mode_diffusion')) {
            $mode = 'broadcast';

            if ($this->filled('destinataire') || $this->filled('service_destinataire_id') || !empty($this->input('recipients'))) {
                $count = count($this->input('recipients', []));
                $mode = $count > 1 ? 'multicast' : 'unicast';
            }

            $this->merge(['mode_diffusion' => $mode]);
        }
    }
}
