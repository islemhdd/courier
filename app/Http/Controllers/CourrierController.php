<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreCourrierRequest;
use App\Http\Requests\UpdateCourrierRequest;
use App\Models\Archive;
use App\Models\Courrier;
use App\Models\CourrierComment;
use App\Models\CourrierType;
use App\Models\Instruction;
use App\Models\NiveauConfidentialite;
use App\Models\Service;
use App\Models\Source;
use App\Models\Structure;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;

class CourrierController extends Controller
{
    public function stats(Request $request): JsonResponse
    {
        $user = $request->user();
        $visible = Courrier::query()->visiblePourUser($user);

        return response()->json([
            'courriers' => [
                'recus' => (clone $visible)->where('type', Courrier::TYPE_ENTRANT)->count(),
                'envoyes' => (clone $visible)->where('type', Courrier::TYPE_SORTANT)->count(),
                'validation' => (clone $visible)->validablesPourUser($user)->count(),
                'archives' => Archive::query()->visiblePourUser($user)->count(),
                'en_attente_reponse' => (clone $visible)->where('requiert_reponse', true)->whereNull('repondu_le')->count(),
            ],
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        return $this->respondWithCourriers($request);
    }

    public function recus(Request $request): JsonResponse
    {
        return $this->respondWithCourriers($request, false, ['type' => Courrier::TYPE_ENTRANT]);
    }

    public function envoyes(Request $request): JsonResponse
    {
        return $this->respondWithCourriers($request, false, ['type' => Courrier::TYPE_SORTANT]);
    }

    public function archives(Request $request): JsonResponse
    {
        $user = $request->user();
        $search = trim((string) $request->get('q', ''));

        $archives = Archive::query()
            ->with($this->archiveRelations())
            ->visiblePourUser($user)
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($subQuery) use ($search) {
                    $subQuery->where('numero', 'like', '%' . $search . '%')
                        ->orWhere('objet', 'like', '%' . $search . '%')
                        ->orWhere('expediteur', 'like', '%' . $search . '%')
                        ->orWhere('destinataire', 'like', '%' . $search . '%');
                });
            })
            ->when($request->filled('date_reception'), fn($query) => $this->applyDateReceptionFilter($query, (string) $request->date_reception))
            ->when($request->filled('numero'), fn($query) => $query->where('numero', 'like', '%' . $request->numero . '%'))
            ->orderByDesc('archive_le')
            ->paginate(15);

        $archives->getCollection()->transform(fn(Archive $archive) => $this->enrichArchive($archive, $user));

        return response()->json([
            'archives' => $archives,
            'courriers' => $archives,
        ]);
    }

    public function validation(Request $request): JsonResponse
    {
        return $this->respondWithCourriers($request, true);
    }

    public function create(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'niveaux_confidentialite' => NiveauConfidentialite::where('rang', '<=', $user->getRangNiveauConfidentialite())->orderBy('rang')->get(),
            'structures' => Structure::with('services')->orderBy('libelle')->get(),
            'services' => Service::with('structure')->orderBy('libelle')->get(),
            'utilisateurs' => User::where('actif', true)
                ->with(['service', 'structure'])
                ->orderBy('prenom')
                ->orderBy('nom')
                ->get(['id', 'nom', 'prenom', 'email', 'service_id', 'structure_id', 'role', 'role_scope'])
                ->map(function (User $user) {
                    return [
                        'id' => $user->id,
                        'nom' => $user->nom,
                        'prenom' => $user->prenom,
                        'nom_complet' => $user->nom_complet,
                        'email' => $user->email,
                        'service_id' => $user->service_id,
                        'structure_id' => $user->structure_id,
                        'role' => $user->role,
                        'role_scope' => $user->role_scope,
                        'service' => $user->service ? [
                            'id' => $user->service->id,
                            'libelle' => $user->service->libelle,
                            'structure_id' => $user->service->structure_id,
                        ] : null,
                        'structure' => $user->structure ? [
                            'id' => $user->structure->id,
                            'libelle' => $user->structure->libelle,
                        ] : null,
                    ];
                }),
            'types' => CourrierType::orderBy('libelle')->get(),
            'sources' => Source::orderBy('libelle')->get(),
            'instructions' => Instruction::orderBy('libelle')->get(),
            'modes_diffusion' => ['unicast', 'multicast', 'broadcast'],
            'can_add_source' => $user->peutAjouterSource(),
            'can_create_incoming_courrier' => $user->peutCreerCourrierRecu(),
            'current_user' => $user->only(['id', 'nom', 'prenom', 'email', 'role', 'role_scope', 'service_id', 'structure_id']),
        ]);
    }

    public function store(StoreCourrierRequest $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validated();

        if (!empty($data['parent_courrier_id'])) {
            $parent = Courrier::find($data['parent_courrier_id']);
            if ($parent && $parent->requiert_reponse && !$parent->peutEtreReponduPar($user)) {
                return response()->json([
                    'message' => 'Vous n\'avez pas le droit de répondre à ce courrier.',
                    'error' => 'unauthorized',
                ], 403);
            }

            // Pour les réponses : définir automatiquement les destinataires
            $data['recipients'] = $this->getReplyRecipients($user);
            $data['mode_diffusion'] = 'multicast'; // Plusieurs destinataires

            // Pour les réponses : forcer certains champs depuis le parent
            $data['type'] = $parent->type; // Même type que le parent
            $data['source_id'] = $parent->source_id ? (int) $parent->source_id : null; // Même source que le parent
            $data['niveau_confidentialite_id'] = $parent->niveau_confidentialite_id ? (int) $parent->niveau_confidentialite_id : null; // Même confidentialité
            $data['service_destinataire_id'] = $parent->service_source_id ? (int) $parent->service_source_id : null; // Destination = service source du parent
            $data['structure_destinataire_id'] = $parent->structure_origine_id ? (int) $parent->structure_origine_id : null; // Structure destination = structure origine du parent
            $data['instructions'] = []; // Pas d'instructions dans une réponse
            $data['commentaire'] = null; // Pas de commentaire dans une réponse
        }

        // Vérifier si l'utilisateur peut créer un courrier reçu (sauf pour les réponses)
        $isReply = !empty($data['parent_courrier_id']);
        if (!$isReply && ($data['type'] ?? Courrier::TYPE_ENTRANT) === Courrier::TYPE_ENTRANT && !$user->peutCreerCourrierRecu()) {
            return response()->json([
                'message' => 'Seul le chef général peut créer un courrier reçu.',
                'error' => 'unauthorized',
            ], 403);
        }

        $courrier = DB::transaction(function () use ($request, $user, $data) {
            $source = $this->resolveOrCreateSource($user, $data);
            $status = $user->estSecretaire() ? Courrier::STATUT_CREE : ($data['type'] === Courrier::TYPE_ENTRANT ? Courrier::STATUT_RECU : Courrier::STATUT_VALIDE);

            $courrier = Courrier::create([
                'objet' => $data['objet'],
                'type' => $data['type'],
                'courrier_type_id' => $data['courrier_type_id'] ?? null,
                'resume' => $data['resume'],
                'date_creation' => now(),
                'date_reception' => $data['date_reception'],
                'expediteur' => $data['expediteur'] ?? (($data['type'] === Courrier::TYPE_ENTRANT && !empty($data['service_source_id'])) ? Service::find($data['service_source_id'])?->libelle : null) ?? $source?->libelle ?? $user->service?->libelle ?? $user->nom_complet,
                'destinataire' => $data['destinataire'] ?? null,
                'source_id' => $source?->id,
                'parent_courrier_id' => $data['parent_courrier_id'] ?? null,
                'requiert_reponse' => (bool) ($data['requiert_reponse'] ?? false),
                'delai_reponse_jours' => $data['delai_reponse_jours'] ?? null,
                'mode_diffusion' => $data['mode_diffusion'],
                'statut' => $status,
                'service_source_id' => $data['service_source_id'] ?? $user->service_id,
                'service_destinataire_id' => $data['service_destinataire_id'] ?? ($data['type'] === Courrier::TYPE_ENTRANT ? $user->service_id : null),
                'structure_origine_id' => $data['structure_origine_id'] ?? null,
                'structure_destinataire_id' => $this->resolveStructureDestinataireId($data),
                'niveau_confidentialite_id' => $data['niveau_confidentialite_id'],
                'createur_id' => $user->id,
            ]);

            $this->syncRecipients($courrier, $data);
            $this->syncConcernedPeople($courrier, $data['concerned_user_ids'] ?? []);
            $this->storeCommentsAndInstructions($courrier, $user, $data['instructions'] ?? []);
            $this->storeAttachments($request, $courrier);

            if ($courrier->statut === Courrier::STATUT_CREE) {
                $this->notifyValidators($courrier, $user);
            }

            return $courrier->load($this->courrierRelations());
        });

        return response()->json([
            'message' => 'Courrier cree avec succes.',
            'courrier' => $this->enrichCourrier($courrier, $user),
        ], 201);
    }

    public function show(Courrier $courrier, Request $request): JsonResponse
    {
        $user = $request->user();
        $courrier->load($this->courrierRelations());

        if (!$courrier->peutVoirExistencePar($user)) {
            return response()->json(['error' => 'Vous n\'avez pas le droit de voir ce courrier.'], 403);
        }

        return response()->json([
            'courrier' => $this->enrichCourrier($courrier, $user),
        ]);
    }

    public function update(UpdateCourrierRequest $request, Courrier $courrier): JsonResponse
    {
        $user = $request->user();
        $data = $request->validated();

        DB::transaction(function () use ($request, $user, $courrier, $data) {
            $source = array_key_exists('source_id', $data) || array_key_exists('source_libelle', $data)
                ? $this->resolveOrCreateSource($user, $data)
                : $courrier->source;

            $courrier->update([
                'objet' => $data['objet'] ?? $courrier->objet,
                'type' => $data['type'] ?? $courrier->type,
                'courrier_type_id' => $data['courrier_type_id'] ?? $courrier->courrier_type_id,
                'resume' => $data['resume'] ?? $courrier->resume,
                'date_reception' => $data['date_reception'] ?? $courrier->date_reception,
                'expediteur' => $data['expediteur'] ?? $courrier->expediteur,
                'destinataire' => $data['destinataire'] ?? $courrier->destinataire,
                'source_id' => $source?->id,
                'parent_courrier_id' => $data['parent_courrier_id'] ?? $courrier->parent_courrier_id,
                'requiert_reponse' => $data['requiert_reponse'] ?? $courrier->requiert_reponse,
                'delai_reponse_jours' => $data['delai_reponse_jours'] ?? $courrier->delai_reponse_jours,
                'mode_diffusion' => $data['mode_diffusion'] ?? $courrier->mode_diffusion,
                'service_source_id' => $data['service_source_id'] ?? $courrier->service_source_id,
                'service_destinataire_id' => $data['service_destinataire_id'] ?? $courrier->service_destinataire_id,
                'structure_origine_id' => $data['structure_origine_id'] ?? $courrier->structure_origine_id,
                'structure_destinataire_id' => $data['structure_destinataire_id'] ?? $courrier->structure_destinataire_id,
                'niveau_confidentialite_id' => $data['niveau_confidentialite_id'] ?? $courrier->niveau_confidentialite_id,
            ]);

            if (array_key_exists('recipients', $data) || array_key_exists('mode_diffusion', $data)) {
                $this->syncRecipients($courrier, $data);
            }

            if (array_key_exists('concerned_user_ids', $data)) {
                $this->syncConcernedPeople($courrier, $data['concerned_user_ids']);
            }

            if (!empty($data['instructions'])) {
                $this->storeCommentsAndInstructions($courrier, $user, $data['instructions']);
            }

            $this->storeAttachments($request, $courrier);
        });

        return response()->json([
            'message' => 'Courrier modifie avec succes.',
            'courrier' => $this->enrichCourrier($courrier->fresh($this->courrierRelations()), $user),
        ]);
    }

    public function destroy(Courrier $courrier, Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$courrier->peutEtreSupprimePar($user)) {
            return response()->json(['error' => 'Vous n\'avez pas le droit de supprimer ce courrier.'], 403);
        }

        foreach ($courrier->attachments as $attachment) {
            Storage::disk('public')->delete($attachment->chemin);
        }

        if ($courrier->chemin_fichier) {
            Storage::disk('public')->delete($courrier->chemin_fichier);
        }

        $courrier->delete();

        return response()->json(['message' => 'Courrier supprime avec succes.']);
    }

    /**
     * Définit automatiquement les destinataires pour une réponse
     */
    private function getReplyRecipients(User $user): array
    {
        $recipients = [];

        // 1. Chef général et son secrétaire
        $chefGeneral = User::where('role', User::ROLE_CHEF)
            ->where('role_scope', User::SCOPE_GENERAL)
            ->where('actif', true)
            ->first();

        if ($chefGeneral) {
            $recipients[] = [
                'recipient_type' => 'user',
                'user_id' => $chefGeneral->id,
            ];
        }

        $secretaireGeneral = User::where('role', User::ROLE_SECRETAIRE)
            ->where('role_scope', User::SCOPE_GENERAL)
            ->where('actif', true)
            ->first();

        if ($secretaireGeneral) {
            $recipients[] = [
                'recipient_type' => 'user',
                'user_id' => $secretaireGeneral->id,
            ];
        }

        // 2. Chef de service de l'utilisateur et son secrétaire
        if ($user->service_id) {
            $chefService = User::where('role', User::ROLE_CHEF)
                ->where('role_scope', User::SCOPE_SERVICE)
                ->where('service_id', $user->service_id)
                ->where('actif', true)
                ->first();

            if ($chefService) {
                $recipients[] = [
                    'recipient_type' => 'user',
                    'user_id' => $chefService->id,
                ];
            }

            $secretaireService = User::where('role', User::ROLE_SECRETAIRE)
                ->where('role_scope', User::SCOPE_SERVICE)
                ->where('service_id', $user->service_id)
                ->where('actif', true)
                ->first();

            if ($secretaireService) {
                $recipients[] = [
                    'recipient_type' => 'user',
                    'user_id' => $secretaireService->id,
                ];
            }
        }

        // 3. Chef de structure de l'utilisateur et son secrétaire
        if ($user->structure_id) {
            $chefStructure = User::where('role', User::ROLE_CHEF)
                ->where('role_scope', User::SCOPE_STRUCTURE)
                ->where('structure_id', $user->structure_id)
                ->where('actif', true)
                ->first();

            if ($chefStructure) {
                $recipients[] = [
                    'recipient_type' => 'user',
                    'user_id' => $chefStructure->id,
                ];
            }

            $secretaireStructure = User::where('role', User::ROLE_SECRETAIRE)
                ->where('role_scope', User::SCOPE_STRUCTURE)
                ->where('structure_id', $user->structure_id)
                ->where('actif', true)
                ->first();

            if ($secretaireStructure) {
                $recipients[] = [
                    'recipient_type' => 'user',
                    'user_id' => $secretaireStructure->id,
                ];
            }
        }

        return $recipients;
    }

    public function destroyArchive(Archive $archive, Request $request): JsonResponse
    {
        if (!$archive->peutEtreSupprimePar($request->user())) {
            return response()->json(['error' => 'Vous n\'avez pas le droit de supprimer cette archive.'], 403);
        }

        if ($archive->chemin_fichier) {
            Storage::disk('public')->delete($archive->chemin_fichier);
        }

        $archive->delete();

        return response()->json(['message' => 'Archive supprimee avec succes.']);
    }

    public function archiver(Courrier $courrier, Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$courrier->peutEtreArchivePar($user)) {
            return response()->json(['error' => 'Ce courrier ne peut pas etre archive.'], 403);
        }

        $archive = DB::transaction(fn() => $this->archiverCourrier($courrier, $user, 'Archivage manuel'));

        return response()->json([
            'message' => 'Courrier archive avec succes.',
            'archive' => $this->enrichArchive($archive, $user),
        ]);
    }

    public function transmettre(Courrier $courrier, Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$courrier->peutEtreTransmisPar($user)) {
            return response()->json(['error' => 'Vous n\'avez pas le droit de transmettre ce courrier.'], 403);
        }

        $validated = $request->validate([
            'recipients' => ['nullable', 'array'],
            'recipients.*.recipient_type' => ['required', 'in:structure,service,user,all'],
            'recipients.*.structure_id' => ['nullable', 'integer', 'exists:structures,id'],
            'recipients.*.service_id' => ['nullable', 'integer', 'exists:services,id'],
            'recipients.*.user_id' => ['nullable', 'integer', 'exists:users,id'],
            'mode_diffusion' => ['nullable', 'in:unicast,multicast,broadcast'],
            'service_destinataire_id' => ['nullable', 'integer', 'exists:services,id'],
            'instructions' => ['sometimes', 'array'],
            'instructions.*.instruction_id' => ['nullable', 'integer', 'exists:instructions,id'],
            'instructions.*.commentaire' => ['nullable', 'string'],
            'commentaire' => ['nullable', 'string'],
        ]);

        $recipientCount = count($validated['recipients'] ?? []);
        $mode = $validated['mode_diffusion'] ?? null;

        if (empty($validated['service_destinataire_id']) && !empty($validated['recipients'])) {
            foreach ($validated['recipients'] as $recipient) {
                if (($recipient['recipient_type'] ?? null) === 'service' && !empty($recipient['service_id'])) {
                    $validated['service_destinataire_id'] = $recipient['service_id'];
                    break;
                }

                if (($recipient['recipient_type'] ?? null) === 'user' && !empty($recipient['user_id'])) {
                    $recipientUser = User::find($recipient['user_id']);
                    if ($recipientUser?->service_id) {
                        $validated['service_destinataire_id'] = $recipientUser->service_id;
                        break;
                    }
                }
            }
        }

        if ($user->estChefStructure()) {
            $this->assertChefStructureTransmissionTargets($user, $validated);
        }

        if (!$mode) {
            $mode = $recipientCount > 1 ? 'multicast' : ($recipientCount === 0 ? ($courrier->mode_diffusion ?: 'unicast') : 'unicast');
        }

        if ($mode !== 'broadcast' && $recipientCount === 0 && !$courrier->service_destinataire_id) {
            return response()->json(['error' => 'Au moins un destinataire est obligatoire pour transmettre ce courrier.'], 422);
        }

        $courrier = DB::transaction(function () use ($courrier, $user, $validated, $mode) {
            $needsChefValidation = $user->estSecretaire();

            $courrier->update([
                'statut' => $needsChefValidation ? Courrier::STATUT_CREE : Courrier::STATUT_TRANSMIS,
                'mode_diffusion' => $mode,
                'service_destinataire_id' => $validated['service_destinataire_id'] ?? $courrier->service_destinataire_id,
                'structure_destinataire_id' => $this->resolveStructureDestinataireId(array_merge($validated, ['structure_destinataire_id' => $courrier->structure_destinataire_id])),
                'transmission_demandee' => $needsChefValidation,
                'transmis_par_id' => $needsChefValidation ? null : $user->id,
                'transmis_le' => $needsChefValidation ? null : now(),
            ]);

            $this->syncRecipients($courrier, array_merge($validated, ['mode_diffusion' => $mode]));

            $instructions = $validated['instructions'] ?? [];
            if (!empty($validated['commentaire'])) {
                $instructions[] = ['commentaire' => $validated['commentaire']];
            }

            if (!empty($instructions)) {
                $this->storeCommentsAndInstructions($courrier, $user, $instructions);
            }

            if ($needsChefValidation) {
                $this->notifyValidators($courrier, $user);
            }

            return $courrier->fresh($this->courrierRelations());
        });

        return response()->json([
            'message' => $user->estSecretaire()
                ? 'Transmission enregistree et envoyee pour validation du chef.'
                : 'Courrier transmis avec succes.',
            'courrier' => $this->enrichCourrier($courrier, $user),
        ]);
    }

    public function valider(Courrier $courrier, Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$courrier->estValidable()) {
            return response()->json(['error' => 'Ce courrier ne peut plus etre valide.'], 422);
        }

        if (!$courrier->peutEtreValidePar($user)) {
            return response()->json(['error' => 'Vous n\'avez pas le droit de valider ce courrier.'], 403);
        }

        DB::transaction(function () use ($courrier, $user) {
            $newStatus = $courrier->transmission_demandee
                ? Courrier::STATUT_TRANSMIS
                : ($courrier->type === Courrier::TYPE_ENTRANT ? Courrier::STATUT_RECU : Courrier::STATUT_VALIDE);

            $courrier->update([
                'statut' => $newStatus,
                'valideur_id' => $user->id,
                'transmission_demandee' => false,
                'transmis_par_id' => $courrier->transmission_demandee ? ($courrier->transmis_par_id ?: $courrier->createur_id) : $courrier->transmis_par_id,
                'transmis_le' => $courrier->transmission_demandee ? now() : $courrier->transmis_le,
            ]);

            CourrierComment::query()
                ->where('courrier_id', $courrier->id)
                ->where('validation_requise', true)
                ->whereNull('valide_le')
                ->update([
                    'valide_par_id' => $user->id,
                    'valide_le' => now(),
                ]);
        });

        return response()->json([
            'message' => 'Courrier valide avec succes.',
            'courrier' => $this->enrichCourrier($courrier->fresh($this->courrierRelations()), $user),
        ]);
    }

    public function nonValider(Courrier $courrier, Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$courrier->peutEtreNonValidePar($user)) {
            return response()->json(['error' => 'Vous n\'avez pas le droit de marquer ce courrier comme non valide.'], 403);
        }

        $courrier->update([
            'statut' => Courrier::STATUT_NON_VALIDE,
            'valideur_id' => $user->id,
        ]);

        return response()->json([
            'message' => 'Courrier marque comme non valide.',
            'courrier' => $this->enrichCourrier($courrier->fresh($this->courrierRelations()), $user),
        ]);
    }

    public function demanderValidation(Courrier $courrier, Request $request): JsonResponse
    {
        $user = $request->user();
        if ($courrier->createur_id !== $user->id && !$user->estAdmin()) {
            return response()->json(['error' => 'Vous ne pouvez pas demander la validation pour ce courrier.'], 403);
        }

        $this->notifyValidators($courrier, $user);

        return response()->json(['message' => 'Demande de validation envoyee.']);
    }

    private function respondWithCourriers(Request $request, bool $onlyValidation = false, array $forcedFilters = []): JsonResponse
    {
        $user = $request->user();
        $filters = array_merge($request->only([
            'q',
            'numero',
            'objet',
            'expediteur',
            'destinataire',
            'statut',
            'type',
            'niveau_confidentialite_id',
            'date_reception',
            'resume',
            'parent_courrier_id',
            'repondu',
            'mois',
            'structure_id',
            'service_id',
        ]), $forcedFilters);

        $query = Courrier::query()
            ->with($this->courrierRelations())
            ->visiblePourUser($user)
            ->when($onlyValidation, fn($builder) => $builder->validablesPourUser($user))
            ->searchAnyField($filters['q'] ?? null)
            ->numero($filters['numero'] ?? null)
            ->objet($filters['objet'] ?? null)
            ->expediteur($filters['expediteur'] ?? null)
            ->destinataire($filters['destinataire'] ?? null)
            ->type($filters['type'] ?? null)
            ->niveauConfidentialite($filters['niveau_confidentialite_id'] ?? null)
            ->dateReception($filters['date_reception'] ?? null)
            ->resumeFullText($filters['resume'] ?? null)
            ->when(!empty($filters['parent_courrier_id']), fn($builder) => $builder->where('parent_courrier_id', $filters['parent_courrier_id']))
            ->when(!empty($filters['mois']), fn($builder) => $builder->dateReception($filters['mois']))
            ->when(!empty($filters['service_id']), function ($builder) use ($filters) {
                $builder->where(function ($sub) use ($filters) {
                    $sub->where('service_source_id', $filters['service_id'])
                        ->orWhere('service_destinataire_id', $filters['service_id'])
                        ->orWhereHas('recipients', fn($q) => $q->where('recipient_type', 'service')->where('service_id', $filters['service_id']));
                });
            })
            ->when(!empty($filters['structure_id']), function ($builder) use ($filters) {
                $builder->where(function ($sub) use ($filters) {
                    $sub->where('structure_origine_id', $filters['structure_id'])
                        ->orWhere('structure_destinataire_id', $filters['structure_id'])
                        ->orWhereHas('recipients', fn($q) => $q->where('recipient_type', 'structure')->where('structure_id', $filters['structure_id']));
                });
            })
            ->when(isset($filters['repondu']), function ($builder) use ($filters) {
                $value = filter_var($filters['repondu'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
                if ($value === true) {
                    $builder->where(function ($sub) {
                        $sub->whereNotNull('repondu_le')->orWhereHas('reponses');
                    });
                } elseif ($value === false) {
                    $builder->where('requiert_reponse', true)->whereNull('repondu_le')->whereDoesntHave('reponses');
                }
            })
            ->orderByDesc('date_creation');

        if (!$onlyValidation && !empty($filters['statut'])) {
            $query->statut($filters['statut']);
        }

        $courriers = $query->paginate(15);
        $courriers->getCollection()->transform(fn(Courrier $courrier) => $this->enrichCourrier($courrier, $user));

        return response()->json([
            'courriers' => $courriers,
            'filtres' => $filters,
        ]);
    }

    private function resolveOrCreateSource(User $user, array $data): ?Source
    {
        if (!empty($data['source_id'])) {
            return Source::find($data['source_id']);
        }

        if (!empty($data['source_libelle']) && $user->peutAjouterSource()) {
            return Source::firstOrCreate(['libelle' => $data['source_libelle']]);
        }

        return null;
    }

    private function syncRecipients(Courrier $courrier, array $data): void
    {
        $courrier->recipients()->delete();

        if (($data['mode_diffusion'] ?? $courrier->mode_diffusion) === 'broadcast') {
            $courrier->recipients()->create(['recipient_type' => 'all']);
            return;
        }

        $recipients = $data['recipients'] ?? [];

        if (empty($recipients) && !empty($data['service_destinataire_id'])) {
            $recipients[] = [
                'recipient_type' => 'service',
                'service_id' => $data['service_destinataire_id'],
            ];
        }

        foreach ($recipients as $recipient) {
            $courrier->recipients()->create([
                'recipient_type' => $recipient['recipient_type'],
                'structure_id' => $recipient['structure_id'] ?? null,
                'service_id' => $recipient['service_id'] ?? null,
                'user_id' => $recipient['user_id'] ?? null,
            ]);
        }
    }

    private function syncConcernedPeople(Courrier $courrier, array $userIds): void
    {
        $courrier->concernedPeople()->sync($userIds);
    }

    private function storeCommentsAndInstructions(Courrier $courrier, User $user, array $items): void
    {
        foreach ($items as $item) {
            $courrier->comments()->create([
                'user_id' => $user->id,
                'instruction_id' => $item['instruction_id'] ?? null,
                'commentaire' => $item['commentaire'] ?? ($item['instruction_id'] ? optional(Instruction::find($item['instruction_id']))->libelle : ''),
                'validation_requise' => (bool) ($item['validation_requise'] ?? $user->estSecretaire()),
            ]);
        }
    }

    private function storeAttachments(Request $request, Courrier $courrier): void
    {
        $files = [];

        if ($request->hasFile('documents')) {
            $files = array_merge($files, $request->file('documents'));
        }

        if ($request->hasFile('fichier')) {
            $files[] = $request->file('fichier');
        }

        foreach ($files as $file) {
            $path = $file->store('courriers', 'public');
            $courrier->attachments()->create([
                'nom_original' => $file->getClientOriginalName(),
                'chemin' => $path,
            ]);

            if (!$courrier->chemin_fichier) {
                $courrier->updateQuietly(['chemin_fichier' => $path]);
            }
        }
    }

    private function notifyValidators(Courrier $courrier, User $actor): void
    {
        $validators = User::query()
            ->where('actif', true)
            ->where('role', User::ROLE_CHEF)
            ->where(function ($query) use ($courrier, $actor) {
                $query->where('service_id', $courrier->service_source_id ?? $actor->service_id)
                    ->orWhere('structure_id', $actor->structure_id)
                    ->orWhere('role_scope', User::SCOPE_GENERAL);
            })
            ->get();

        if ($validators->isNotEmpty()) {
            Notification::send($validators, new \App\Notifications\ValidationRequestedNotification($courrier));
        }
    }

    private function archiverCourrier(Courrier $courrier, User $user, string $motif): Archive
    {
        $archive = Archive::create([
            'courrier_original_id' => $courrier->id,
            'numero' => $courrier->numero,
            'objet' => $courrier->objet,
            'type' => $courrier->type,
            'chemin_fichier' => $courrier->chemin_fichier,
            'date_creation' => $courrier->date_creation,
            'date_reception' => $courrier->date_reception,
            'expediteur' => $courrier->expediteur,
            'destinataire' => $courrier->destinataire,
            'statut_original' => $courrier->statut,
            'niveau_confidentialite_id' => $courrier->niveau_confidentialite_id,
            'createur_id' => $courrier->createur_id,
            'valideur_id' => $courrier->valideur_id,
            'service_source_id' => $courrier->service_source_id,
            'service_destinataire_id' => $courrier->service_destinataire_id,
            'transmis_par_id' => $courrier->transmis_par_id,
            'transmis_le' => $courrier->transmis_le,
            'archive_par_id' => $user->id,
            'archive_le' => now(),
            'motif' => $motif,
        ]);

        $courrier->delete();

        return $archive->load($this->archiveRelations());
    }

    private function enrichCourrier(Courrier $courrier, ?User $user): Courrier
    {
        $courrier->peut_voir_details = $user ? $courrier->peutEtreVuEnDetailPar($user) : false;
        $courrier->peut_voir_existence = $user ? $courrier->peutVoirExistencePar($user) : false;
        $courrier->est_accessible = $courrier->peut_voir_details;
        $courrier->peut_etre_valide = $user ? $courrier->peutEtreValidePar($user) : false;
        $courrier->peut_etre_modifie = $user ? $courrier->peutEtreModifiePar($user) : false;
        $courrier->peut_etre_supprime = $user ? $courrier->peutEtreSupprimePar($user) : false;
        $courrier->peut_etre_archive = $user ? $courrier->peutEtreArchivePar($user) : false;
        $courrier->peut_etre_transmis = $user ? $courrier->peutEtreTransmisPar($user) : false;
        $courrier->peut_etre_non_valide = $user ? $courrier->peutEtreNonValidePar($user) : false;
        $courrier->peut_etre_repondu = $user ? $courrier->peutEtreReponduPar($user) : false;
        $courrier->peut_repondre = $user
            ? ($courrier->peut_voir_details && $courrier->peut_etre_repondu === true)
            : false;
        $courrier->contenu_restreint = !$courrier->peut_voir_details;
        $courrier->chaine_reponses = $courrier->reponses;

        if (!$courrier->peut_voir_details) {
            $courrier->chemin_fichier = null;
        }

        return $courrier;
    }

    private function enrichArchive(Archive $archive, ?User $user): Archive
    {
        $archive->peut_voir_details = $user ? $archive->peutEtreVuEnDetailPar($user) : false;
        $archive->peut_voir_existence = $user ? $archive->peutVoirExistencePar($user) : false;
        $archive->est_accessible = $archive->peut_voir_details;
        $archive->peut_etre_supprime = $user ? $archive->peutEtreSupprimePar($user) : false;
        $archive->contenu_restreint = !$archive->peut_voir_details;

        if (!$archive->peut_voir_details) {
            $archive->chemin_fichier = null;
        }

        return $archive;
    }

    private function applyDateReceptionFilter($query, string $dateReception): void
    {
        if (str_contains($dateReception, '|')) {
            $dates = explode('|', $dateReception);
            if (count($dates) === 2) {
                $query->whereBetween('date_reception', [
                    \Carbon\Carbon::parse($dates[0])->startOfDay(),
                    \Carbon\Carbon::parse($dates[1])->endOfDay(),
                ]);
            }
            return;
        }

        if (preg_match('/^\d{4}$/', $dateReception)) {
            $query->whereYear('date_reception', $dateReception);
            return;
        }

        if (preg_match('/^\d{4}-\d{2}$/', $dateReception)) {
            $query->whereYear('date_reception', substr($dateReception, 0, 4))
                ->whereMonth('date_reception', substr($dateReception, 5, 2));
            return;
        }

        $query->whereDate('date_reception', \Carbon\Carbon::parse($dateReception));
    }

    private function resolveStructureDestinataireId(array $data): ?int
    {
        // Si une structure destinataire est explicitement définie, l'utiliser
        if (!empty($data['structure_destinataire_id'])) {
            return $data['structure_destinataire_id'];
        }

        // Sinon, déterminer à partir des destinataires
        $recipients = $data['recipients'] ?? [];

        foreach ($recipients as $recipient) {
            if (($recipient['recipient_type'] ?? null) === 'structure' && !empty($recipient['structure_id'])) {
                return $recipient['structure_id'];
            }

            if (($recipient['recipient_type'] ?? null) === 'service' && !empty($recipient['service_id'])) {
                $service = Service::find($recipient['service_id']);
                if ($service?->structure_id) {
                    return $service->structure_id;
                }
            }

            if (($recipient['recipient_type'] ?? null) === 'user' && !empty($recipient['user_id'])) {
                $recipientUser = User::find($recipient['user_id']);
                if ($recipientUser?->structure_id) {
                    return $recipientUser->structure_id;
                }
            }
        }

        return null;
    }

    private function assertChefStructureTransmissionTargets(User $user, array $data): void
    {
        if (!$user->structure_id) {
            abort(403, 'Chef de structure sans structure définie.');
        }

        if (($data['mode_diffusion'] ?? null) === 'broadcast') {
            abort(422, 'Un chef de structure ne peut pas transmettre en mode broadcast.');
        }

        if (!empty($data['service_destinataire_id'])) {
            $service = Service::find($data['service_destinataire_id']);
            if (!$service || $service->structure_id !== $user->structure_id) {
                abort(422, 'Le service destinataire doit appartenir à votre structure.');
            }
        }

        foreach ($data['recipients'] ?? [] as $recipient) {
            $recipientType = $recipient['recipient_type'] ?? null;

            if ($recipientType === 'service') {
                if (empty($recipient['service_id'])) {
                    abort(422, 'Service destinataire invalide.');
                }

                $service = Service::find($recipient['service_id']);
                if (!$service || $service->structure_id !== $user->structure_id) {
                    abort(422, 'Le service destinataire doit appartenir à votre structure.');
                }
            }

            if ($recipientType === 'user') {
                if (empty($recipient['user_id'])) {
                    abort(422, 'Utilisateur destinataire invalide.');
                }

                $recipientUser = User::find($recipient['user_id']);
                if (!$recipientUser || !$recipientUser->service_id) {
                    abort(422, 'Utilisateur destinataire invalide.');
                }

                $service = Service::find($recipientUser->service_id);
                if (!$service || $service->structure_id !== $user->structure_id) {
                    abort(422, 'L\'utilisateur destinataire doit appartenir à un service de votre structure.');
                }
            }

            if ($recipientType === 'structure') {
                if (empty($recipient['structure_id']) || $recipient['structure_id'] !== $user->structure_id) {
                    abort(422, 'Un chef de structure ne peut transmettre qu\'à sa propre structure si la destination est une structure.');
                }
            }
        }
    }

    private function courrierRelations(): array
    {
        return [
            'courrierType',
            'niveauConfidentialite',
            'createur',
            'valideur',
            'serviceSource.structure',
            'serviceDestinataire.structure',
            'transmisPar',
            'source',
            'parent',
            'reponses',
            'attachments',
            'comments.user',
            'comments.instruction',
            'comments.validePar',
            'recipients.structure',
            'recipients.service',
            'recipients.user',
            'concernedPeople',
        ];
    }

    private function archiveRelations(): array
    {
        return [
            'niveauConfidentialite',
            'createur',
            'valideur',
            'serviceSource.structure',
            'serviceDestinataire.structure',
            'transmisPar',
            'archivePar',
        ];
    }
}
