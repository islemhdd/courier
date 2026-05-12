<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreCourrierRequest;
use App\Http\Requests\UpdateCourrierRequest;
use App\Jobs\ProcessOcrJob;
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
use App\Notifications\CourrierReponduNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Http\Request;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

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
        $user = $request->user();

        $filters = array_merge($request->only([
            'q',
            'numero',
            'objet',
            'expediteur',
            'destinataire',
            'statut',
            'niveau_confidentialite_id',
            'date_reception',
            'resume',
            'parent_courrier_id',
            'repondu',
            'mois',
            'structure_id',
            'service_id',
        ]));

        $query = Courrier::query()
            ->with($this->courrierListRelations())
            ->visiblePourUser($user)
            ->where(function ($builder) use ($user) {
                $builder->where('type', Courrier::TYPE_SORTANT)
                    ->orWhere('createur_id', $user->id);
            })
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
            ->when(!empty($filters['statut']), fn($builder) => $builder->statut($filters['statut']))
            ->orderByDesc('date_creation');

        $courriers = $query->paginate(15);
        $courriers->getCollection()->transform(fn(Courrier $courrier) => $this->enrichCourrier($courrier, $user));

        return response()->json([
            'courriers' => $courriers,
            'filtres' => $filters,
        ]);
    }

    public function archives(Request $request): JsonResponse
    {
        $user = $request->user();
        $filters = $this->archiveFilters($request);

        $query = Archive::query()
            ->with($this->archiveRelations())
            ->visiblePourUser($user);

        $this->applyArchiveFilters($query, $filters);

        $archives = $filters['q'] === ''
            ? $query->orderByDesc('archive_le')->paginate(15)
            : $this->paginateArchiveSearch($query, $filters['q'], $request);

        $archives->getCollection()->transform(fn(Archive $archive) => $this->enrichArchive($archive, $user));

        return response()->json([
            'archives' => $archives,
            'courriers' => $archives,
            'filtres' => $filters,
        ]);
    }

    public function showArchive(Archive $archive, Request $request): JsonResponse
    {
        $user = $request->user();

        $archive->load($this->archiveRelations());

        if (!$archive->peutVoirExistencePar($user)) {
            return response()->json(['error' => 'Archive introuvable.'], 404);
        }

        $search = trim((string) $request->get('q', ''));
        if ($search !== '') {
            $this->applyArchiveSearchMetadata($archive, $search);
        }

        $archive = $this->enrichArchive($archive, $user);

        return response()->json([
            'archive' => $archive,
            'courrier' => $archive,
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
            if (!$parent || !$parent->peutEtreReponduPar($user)) {
                return response()->json([
                    'message' => 'Vous n\'avez pas le droit de répondre à ce courrier.',
                    'error' => 'unauthorized',
                ], 403);
            }

            // Pour les réponses : définir automatiquement les destinataires
            $data['recipients'] = $this->getReplyRecipients($user);
            $data['mode_diffusion'] = 'multicast'; // Plusieurs destinataires

            // Pour les réponses : forcer certains champs depuis le parent
            $data['type'] = Courrier::TYPE_ENTRANT;
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
                'message' => 'Seul le chef général ou le secrétaire général peut créer un courrier reçu.',
                'error' => 'unauthorized',
            ], 403);
        }

        $courrier = DB::transaction(function () use ($request, $user, $data) {
            $source = $this->resolveOrCreateSource($user, $data);

            // Déterminer le statut du courrier
            // Les courriers créés par un utilisateur autre que le chef général ou l'admin
            // sont enregistrés en statut CREE pour validation par le chef général.
            if (!$user->estChefGeneral() && !$user->estAdmin()) {
                $status = Courrier::STATUT_CREE;
            } elseif ($data['type'] === Courrier::TYPE_ENTRANT) {
                $status = Courrier::STATUT_RECU;
            } else {
                $status = Courrier::STATUT_VALIDE;
            }

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

        if ($courrier->attachments()->exists()) {
            ProcessOcrJob::dispatch($courrier);
        }

        if (!$courrier->transmission_demandee && $courrier->statut !== Courrier::STATUT_CREE) {
            $this->notifyRecipientsOfCourrier($courrier);
        }

        if ($isReply) {
            $this->notifyReplyRecipients($courrier);
        }

        return response()->json([
            'message' => 'Courrier créé avec succès.',
            'courrier' => $this->enrichCourrier($courrier, $user),
        ], 201);
    }

    public function show(Courrier $courrier, Request $request): JsonResponse
    {
        $user = $request->user();
        $courrier->load($this->courrierRelations());

        if (!$courrier->peutVoirExistencePar($user)) {
            return response()->json(['error' => 'Courrier introuvable.'], 404);
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

        if ($request->hasFile('documents') || $request->hasFile('fichier')) {
            ProcessOcrJob::dispatch($courrier->fresh());
        }

        return response()->json([
            'message' => 'Courrier modifié avec succès.',
            'courrier' => $this->enrichCourrier($courrier->fresh($this->courrierRelations()), $user),
        ]);
    }

    public function destroy(Courrier $courrier, Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$courrier->peutEtreSupprimePar($user)) {
            return response()->json(['error' => 'Vous n\'avez pas le droit de supprimer ce courrier.'], 403);
        }

        $courrier->delete();

        return response()->json(['message' => 'Courrier supprimé avec succès.']);
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

    public function downloadAttachment(Courrier $courrier, int $attachmentId, Request $request): StreamedResponse|JsonResponse
    {
        $user = $request->user();

        if (!$courrier->peutEtreConsultePar($user)) {
            return response()->json(['error' => 'Vous n\'avez pas le droit de télécharger ce fichier.'], 403);
        }

        $attachment = $courrier->attachments()->find($attachmentId);

        if (!$attachment || !Storage::disk('local')->exists($attachment->chemin)) {
            return response()->json(['error' => 'Fichier introuvable.'], 404);
        }

        return Storage::disk('local')->download($attachment->chemin, $attachment->nom_original);
    }

    public function downloadCourrierFile(Courrier $courrier, Request $request): StreamedResponse|JsonResponse
    {
        $user = $request->user();

        if (!$courrier->peutEtreConsultePar($user)) {
            return response()->json(['error' => 'Vous n\'avez pas le droit de télécharger ce fichier.'], 403);
        }

        if (!$courrier->chemin_fichier || !Storage::disk('local')->exists($courrier->chemin_fichier)) {
            return response()->json(['error' => 'Fichier introuvable.'], 404);
        }

        return Storage::disk('local')->download($courrier->chemin_fichier);
    }

    public function destroyArchive(Archive $archive, Request $request): JsonResponse
    {
        if (!$archive->peutEtreSupprimePar($request->user())) {
            return response()->json(['error' => 'Vous n\'avez pas le droit de supprimer cette archive.'], 403);
        }

        if ($archive->chemin_fichier) {
            Storage::disk('local')->delete($archive->chemin_fichier);
        }

        $archive->delete();

        return response()->json(['message' => 'Archive supprimée avec succès.']);
    }

    public function archiver(Courrier $courrier, Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$courrier->peutEtreArchivePar($user)) {
            return response()->json(['error' => 'Ce courrier ne peut pas être archivé.'], 403);
        }

        $archive = DB::transaction(fn() => $this->archiverCourrier($courrier, $user, 'Archivage manuel'));

        return response()->json([
            'message' => 'Courrier archivé avec succès.',
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
            return response()->json(['error' => 'Au moins un destinataire est obligatoire pour transmettre ce courrier.'], 429);
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
            } else {
                $this->notifyRecipientsOfCourrier($courrier);
            }

            return $courrier->fresh($this->courrierRelations());
        });

        return response()->json([
            'message' => $user->estSecretaire()
                ? 'Transmission enregistrée et envoyée pour validation du chef.'
                : 'Courrier transmis avec succès.',
            'courrier' => $this->enrichCourrier($courrier, $user),
        ]);
    }

    public function valider(Courrier $courrier, Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$courrier->estValidable()) {
            return response()->json(['error' => 'Ce courrier ne peut plus être validé.'], 422);
        }

        if (!$courrier->peutEtreValidePar($user)) {
            return response()->json(['error' => 'Vous n\'avez pas le droit de valider ce courrier.'], 403);
        }

        $wasTransmissionRequested = $courrier->transmission_demandee;

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

        if ($wasTransmissionRequested) {
            $this->notifyRecipientsOfCourrier($courrier);
        }

        return response()->json([
            'message' => 'Courrier validé avec succès.',
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
            'message' => 'Courrier marqué comme non valide.',
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

        return response()->json(['message' => 'Demande de validation envoyée.']);
    }

    private function respondWithCourriers(Request $request, bool $onlyValidation = false, array $forcedFilters = []): JsonResponse
    {
        $user = $request->user();
        $filters = collect(array_merge($request->only([
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
        ]), $forcedFilters))->map(fn($value) => is_string($value) ? htmlspecialchars($value, ENT_QUOTES, 'UTF-8') : $value)->toArray();

        $query = Courrier::query()
            ->with($this->courrierListRelations())
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

        // Pour les courriers sortants, on ne crée pas de nouvelle source
        // source_id doit être obligatoire (validé en StoreCourrierRequest)
        if ($data['type'] === Courrier::TYPE_SORTANT) {
            return null;
        }

        if (!empty($data['source_libelle']) && $user->peutAjouterSource()) {
            return Source::firstOrCreate(['libelle' => $data['source_libelle']]);
        }

        return null;
    }

    private function syncRecipients(Courrier $courrier, array $data): void
    {
        $courrier->recipients()->delete();

        // Pour les courriers sortants sans parent (pas des réponses), ne pas synchroniser les destinataires
        if ($courrier->type === Courrier::TYPE_SORTANT && !$courrier->parent_courrier_id) {
            return;
        }

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
            $safeName = preg_replace('/[^a-zA-Z0-9._-]/', '', $file->getClientOriginalName());
            $path = $file->storeAs('courriers', uniqid() . '_' . $safeName, 'local');
            $courrier->attachments()->create([
                'nom_original' => $safeName,
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

    private function notifyRecipientsOfCourrier(Courrier $courrier): void
    {
        $users = $this->getUsersReceivingCourrier($courrier);

        if ($users->isNotEmpty()) {
            Notification::send($users, new \App\Notifications\CourrierReceivedNotification($courrier));
        }
    }

    private function notifyReplyRecipients(Courrier $reply): void
    {
        if (!$reply->parent) {
            return;
        }

        $users = $this->getUsersConcernedByCourrier($reply->parent);

        if ($users->isNotEmpty()) {
            Notification::send($users, new CourrierReponduNotification($reply));
        }
    }

    private function getUsersReceivingCourrier(Courrier $courrier): \Illuminate\Support\Collection
    {
        if ($courrier->recipients()->where('recipient_type', 'all')->exists()) {
            return User::where('actif', true)->get();
        }

        $recipients = $courrier->recipients()->get();
        $userIds = $recipients->where('recipient_type', 'user')->pluck('user_id')->filter()->unique()->all();
        $serviceIds = $recipients->where('recipient_type', 'service')->pluck('service_id')->filter()->unique()->all();
        $structureIds = $recipients->where('recipient_type', 'structure')->pluck('structure_id')->filter()->unique()->all();

        // REMOVED: Ne pas utiliser les champs service_destinataire_id et structure_destinataire_id
        // car ils sont utilisés dans le flux externe (à implémenter dans le futur)

        $serviceIds = array_unique(array_filter($serviceIds));
        $structureIds = array_unique(array_filter($structureIds));

        if (empty($userIds) && empty($serviceIds) && empty($structureIds)) {
            return collect();
        }

        return User::where('actif', true)
            ->where(function ($query) use ($userIds, $serviceIds, $structureIds) {
                if (!empty($userIds)) {
                    $query->orWhereIn('id', $userIds);
                }

                if (!empty($serviceIds)) {
                    $query->orWhereIn('service_id', $serviceIds);
                }

                if (!empty($structureIds)) {
                    $query->orWhereIn('structure_id', $structureIds);
                }
            })
            ->get()
            ->unique('id')
            ->values();
    }

    private function getUsersConcernedByCourrier(Courrier $courrier): \Illuminate\Support\Collection
    {
        if ($courrier->recipients()->where('recipient_type', 'all')->exists()) {
            return User::where('actif', true)->get();
        }

        $userIds = collect([
            $courrier->createur_id,
            $courrier->valideur_id,
            $courrier->transmis_par_id,
        ])->filter()->unique()->all();

        $userIds = array_merge($userIds, $courrier->concernedPeople()->pluck('users.id')->filter()->all());

        $recipientRows = $courrier->recipients()->get();
        $userIds = array_merge($userIds, $recipientRows->where('recipient_type', 'user')->pluck('user_id')->filter()->all());
        $serviceIds = $recipientRows->where('recipient_type', 'service')->pluck('service_id')->filter()->all();
        $structureIds = $recipientRows->where('recipient_type', 'structure')->pluck('structure_id')->filter()->all();

        // REMOVED: Ne pas utiliser les champs service_destinataire_id et structure_destinataire_id
        // car ils sont utilisés dans le flux externe (à implémenter dans le futur)

        $userIds = array_unique(array_filter($userIds));
        $serviceIds = array_unique(array_filter($serviceIds));
        $structureIds = array_unique(array_filter($structureIds));

        if (empty($userIds) && empty($serviceIds) && empty($structureIds)) {
            return collect();
        }

        return User::where('actif', true)
            ->where(function ($query) use ($userIds, $serviceIds, $structureIds) {
                if (!empty($userIds)) {
                    $query->orWhereIn('id', $userIds);
                }

                if (!empty($serviceIds)) {
                    $query->orWhereIn('service_id', $serviceIds);
                }

                if (!empty($structureIds)) {
                    $query->orWhereIn('structure_id', $structureIds);
                }
            })
            ->get()
            ->unique('id')
            ->values();
    }

    private function archiverCourrier(Courrier $courrier, User $user, string $motif): Archive
    {
        $courrier->loadMissing([
            'attachments',
            'comments.user',
            'comments.instruction',
            'comments.validePar',
        ]);

        $archive = Archive::create([
            'courrier_original_id' => $courrier->id,
            'numero' => $courrier->numero,
            'objet' => $courrier->objet,
            'type' => $courrier->type,
            'courrier_type_id' => $courrier->courrier_type_id,
            'resume' => $courrier->resume,
            'extracted_text' => $courrier->extracted_text,
            'ocr_status' => $courrier->ocr_status,
            'summary_source' => $courrier->summary_source,
            'chemin_fichier' => $courrier->chemin_fichier,
            'date_creation' => $courrier->date_creation,
            'date_reception' => $courrier->date_reception,
            'date_limite_reponse' => $courrier->date_limite_reponse,
            'repondu_le' => $courrier->repondu_le,
            'expediteur' => $courrier->expediteur,
            'destinataire' => $courrier->destinataire,
            'source_id' => $courrier->source_id,
            'statut_original' => $courrier->statut,
            'niveau_confidentialite_id' => $courrier->niveau_confidentialite_id,
            'createur_id' => $courrier->createur_id,
            'valideur_id' => $courrier->valideur_id,
            'service_source_id' => $courrier->service_source_id,
            'service_destinataire_id' => $courrier->service_destinataire_id,
            'structure_origine_id' => $courrier->structure_origine_id,
            'structure_destinataire_id' => $courrier->structure_destinataire_id,
            'transmis_par_id' => $courrier->transmis_par_id,
            'transmis_le' => $courrier->transmis_le,
            'archive_par_id' => $user->id,
            'archive_le' => now(),
            'motif' => $motif,
            'attachments_snapshot' => $this->archiveAttachmentSnapshot($courrier),
            'comments_snapshot' => $this->archiveCommentSnapshot($courrier),
        ]);

        $courrier->delete();

        return $archive->load($this->archiveRelations());
    }

    private function archiveAttachmentSnapshot(Courrier $courrier): array
    {
        return $courrier->attachments
            ->map(fn($attachment) => [
                'id' => $attachment->id,
                'nom_original' => $attachment->nom_original,
                'chemin' => $attachment->chemin,
                'ocr_text' => $attachment->ocr_text,
                'ocr_language' => $attachment->ocr_language,
                'ocr_status' => $attachment->ocr_status,
                'ocr_confidence' => $attachment->ocr_confidence,
                'ocr_error' => $attachment->ocr_error,
                'ocr_processed_at' => $attachment->ocr_processed_at,
            ])
            ->values()
            ->all();
    }

    private function archiveCommentSnapshot(Courrier $courrier): array
    {
        return $courrier->comments
            ->map(fn($comment) => [
                'id' => $comment->id,
                'commentaire' => $comment->commentaire,
                'validation_requise' => $comment->validation_requise,
                'valide_le' => $comment->valide_le,
                'user' => $comment->user ? [
                    'id' => $comment->user->id,
                    'nom' => $comment->user->nom,
                    'prenom' => $comment->user->prenom,
                    'nom_complet' => $comment->user->nom_complet,
                    'email' => $comment->user->email,
                ] : null,
                'instruction' => $comment->instruction ? [
                    'id' => $comment->instruction->id,
                    'libelle' => $comment->instruction->libelle,
                ] : null,
                'valide_par' => $comment->validePar ? [
                    'id' => $comment->validePar->id,
                    'nom' => $comment->validePar->nom,
                    'prenom' => $comment->validePar->prenom,
                    'nom_complet' => $comment->validePar->nom_complet,
                ] : null,
            ])
            ->values()
            ->all();
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
        $courrier->chaine_reponses = $courrier->reponses->map(function ($reply) use ($user) {
            $reply->peut_voir_details = $user ? $reply->peutEtreVuEnDetailPar($user) : false;
            $reply->peut_voir_existence = $user ? $reply->peutVoirExistencePar($user) : false;
            $reply->est_accessible = $reply->peut_voir_details;
            return $reply;
        })->all();

        if (!$courrier->peut_voir_details) {
            $courrier->chemin_fichier = null;
            $courrier->extracted_text = null;
        }

        $courrier->resume_auto_genere = $courrier->resume_auto_genere;

        if ($courrier->relationLoaded('parent') && $courrier->parent) {
            $courrier->parent->peut_voir_details = $user ? $courrier->parent->peutEtreVuEnDetailPar($user) : false;
            $courrier->parent->peut_voir_existence = $user ? $courrier->parent->peutVoirExistencePar($user) : false;
            $courrier->parent->est_accessible = $courrier->parent->peut_voir_details;
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
        $archive->attachments = $archive->attachments_snapshot ?? [];
        $archive->comments = $archive->comments_snapshot ?? [];

        if (!$archive->peut_voir_details) {
            $archive->chemin_fichier = null;
            $archive->resume = null;
            $archive->extracted_text = null;
            $archive->attachments = [];
            $archive->comments = [];
        }

        return $archive;
    }

    private function archiveFilters(Request $request): array
    {
        $filters = [];

        foreach ([
            'q',
            'numero',
            'objet',
            'titre',
            'contenu',
            'expediteur',
            'destinataire',
            'type',
            'statut_original',
            'date_from',
            'date_to',
            'date_reception',
            'date_reception_from',
            'date_reception_to',
            'archive_from',
            'archive_to',
            'service_id',
            'structure_id',
            'niveau_confidentialite_id',
        ] as $key) {
            $value = $request->get($key);
            $filters[$key] = is_string($value) ? trim($value) : $value;
        }

        $filters['q'] = (string) ($filters['q'] ?? '');

        return $filters;
    }

    private function applyArchiveFilters(Builder $query, array $filters): void
    {
        $query
            ->when(filled($filters['numero'] ?? null), fn(Builder $builder) => $builder->where('numero', 'like', $filters['numero'] . '%'))
            ->when(filled($filters['objet'] ?? null) || filled($filters['titre'] ?? null), function (Builder $builder) use ($filters) {
                $term = filled($filters['objet'] ?? null) ? $filters['objet'] : $filters['titre'];
                $builder->where('objet', 'like', '%' . $term . '%');
            })
            ->when(filled($filters['contenu'] ?? null), fn(Builder $builder) => $this->applyArchiveContentSearch($builder, $filters['contenu']))
            ->when(filled($filters['expediteur'] ?? null), fn(Builder $builder) => $builder->where('expediteur', 'like', '%' . $filters['expediteur'] . '%'))
            ->when(filled($filters['destinataire'] ?? null), fn(Builder $builder) => $builder->where('destinataire', 'like', '%' . $filters['destinataire'] . '%'))
            ->when(filled($filters['type'] ?? null), fn(Builder $builder) => $builder->where('type', $filters['type']))
            ->when(filled($filters['statut_original'] ?? null), fn(Builder $builder) => $builder->where('statut_original', $filters['statut_original']))
            ->when(filled($filters['niveau_confidentialite_id'] ?? null), fn(Builder $builder) => $builder->where('niveau_confidentialite_id', $filters['niveau_confidentialite_id']))
            ->when($filters['service_id'] ?? null, function (Builder $builder, $serviceId) {
                $builder->where(function (Builder $subQuery) use ($serviceId) {
                    $subQuery->where('service_source_id', $serviceId)
                        ->orWhere('service_destinataire_id', $serviceId);
                });
            })
            ->when($filters['structure_id'] ?? null, function (Builder $builder, $structureId) {
                $builder->where(function (Builder $subQuery) use ($structureId) {
                    $subQuery->where('structure_origine_id', $structureId)
                        ->orWhere('structure_destinataire_id', $structureId)
                        ->orWhereHas('serviceSource', fn(Builder $serviceQuery) => $serviceQuery->where('structure_id', $structureId))
                        ->orWhereHas('serviceDestinataire', fn(Builder $serviceQuery) => $serviceQuery->where('structure_id', $structureId));
                });
            });

        if (!empty($filters['date_reception'])) {
            $this->applyArchiveExactDateFilter($query, 'date_reception', (string) $filters['date_reception']);
        }

        $this->applyArchiveDateRangeFilter(
            $query,
            'date_reception',
            $filters['date_reception_from'] ?: $filters['date_from'],
            $filters['date_reception_to'] ?: $filters['date_to'],
        );

        $this->applyArchiveDateRangeFilter($query, 'archive_le', $filters['archive_from'], $filters['archive_to']);
    }

    private function applyArchiveContentSearch(Builder $query, string $term): void
    {
        $query->where(function (Builder $subQuery) use ($term) {
            $like = '%' . $term . '%';

            $subQuery->where('resume', 'like', $like)
                ->orWhere('extracted_text', 'like', $like)
                ->orWhere('attachments_snapshot', 'like', $like)
                ->orWhere('comments_snapshot', 'like', $like);
        });
    }

    private function applyArchiveGeneralSearch(Builder $query, string $term): void
    {
        $query->where(function (Builder $subQuery) use ($term) {
            $like = '%' . $term . '%';
            $prefixLike = $term . '%';

            $subQuery->where('numero', 'like', $prefixLike)
                ->orWhere('objet', 'like', $like)
                ->orWhere('resume', 'like', $like)
                ->orWhere('extracted_text', 'like', $like)
                ->orWhere('expediteur', 'like', $like)
                ->orWhere('destinataire', 'like', $like)
                ->orWhere('motif', 'like', $like)
                ->orWhere('attachments_snapshot', 'like', $like)
                ->orWhere('comments_snapshot', 'like', $like)
                ->orWhereHas('serviceSource', fn(Builder $relationQuery) => $relationQuery->where('libelle', 'like', $like))
                ->orWhereHas('serviceDestinataire', fn(Builder $relationQuery) => $relationQuery->where('libelle', 'like', $like))
                ->orWhereHas('structureOrigine', fn(Builder $relationQuery) => $relationQuery->where('libelle', 'like', $like))
                ->orWhereHas('structureDestinataire', fn(Builder $relationQuery) => $relationQuery->where('libelle', 'like', $like))
                ->orWhereHas('courrierType', fn(Builder $relationQuery) => $relationQuery->where('libelle', 'like', $like))
                ->orWhereHas('source', fn(Builder $relationQuery) => $relationQuery->where('libelle', 'like', $like));
        });
    }

    private function paginateArchiveSearch(Builder $query, string $search, Request $request): LengthAwarePaginator
    {
        $candidates = (clone $query)->orderByDesc('archive_le')->get();

        $matches = $candidates
            ->map(function (Archive $archive) use ($search) {
                return $this->applyArchiveSearchMetadata($archive, $search) ? $archive : null;
            })
            ->filter()
            ->sort(function (Archive $left, Archive $right) {
                $scoreComparison = ($left->match_score ?? 999) <=> ($right->match_score ?? 999);

                if ($scoreComparison !== 0) {
                    return $scoreComparison;
                }

                $dateComparison = ($right->archive_le?->getTimestamp() ?? 0) <=> ($left->archive_le?->getTimestamp() ?? 0);

                return $dateComparison !== 0 ? $dateComparison : $left->id <=> $right->id;
            })
            ->values();

        $perPage = 15;
        $page = max(1, $request->integer('page', 1));

        return new LengthAwarePaginator(
            $matches->forPage($page, $perPage)->values(),
            $matches->count(),
            $perPage,
            $page,
            [
                'path' => $request->url(),
                'query' => $request->query(),
            ],
        );
    }

    private function applyArchiveSearchMetadata(Archive $archive, string $search): bool
    {
        $normalizedSearch = $this->normalizeArchiveSearchText($search);

        if ($normalizedSearch === '') {
            return false;
        }

        $maxDistance = $this->archiveLevenshteinMaxDistance($normalizedSearch);
        $bestScore = null;
        $matchedFields = [];

        foreach ($this->archiveSearchValues($archive) as $field => $value) {
            $score = $this->archiveFieldLevenshteinScore($normalizedSearch, $value, $maxDistance);

            if ($score === null) {
                continue;
            }

            if ($bestScore === null || $score < $bestScore) {
                $bestScore = $score;
                $matchedFields = [$field];
                continue;
            }

            if ($score === $bestScore) {
                $matchedFields[] = $field;
            }
        }

        if ($bestScore === null) {
            return false;
        }

        $archive->search_term = $search;
        $archive->search_score = $bestScore;
        $archive->match_score = $bestScore;
        $archive->matched_fields = array_values(array_unique($matchedFields));

        return true;
    }

    private function archiveSearchValues(Archive $archive): array
    {
        $attachmentsText = collect($archive->attachments_snapshot ?? [])
            ->map(function ($attachment) {
                $attachment = is_array($attachment) ? $attachment : [];

                return implode(' ', array_filter([
                    $attachment['nom_original'] ?? null,
                    $attachment['ocr_text'] ?? null,
                    $attachment['ocr_error'] ?? null,
                ]));
            })
            ->implode(' ');

        $commentsText = collect($archive->comments_snapshot ?? [])
            ->map(function ($comment) {
                $comment = is_array($comment) ? $comment : [];

                return implode(' ', array_filter([
                    $comment['commentaire'] ?? null,
                    $comment['instruction']['libelle'] ?? null,
                    $comment['user']['nom_complet'] ?? null,
                ]));
            })
            ->implode(' ');

        return [
            'numero' => (string) $archive->numero,
            'objet' => (string) $archive->objet,
            'resume' => (string) $archive->resume,
            'extracted_text' => (string) $archive->extracted_text,
            'expediteur' => (string) $archive->expediteur,
            'destinataire' => (string) $archive->destinataire,
            'motif' => (string) $archive->motif,
            'service_source' => (string) $archive->serviceSource?->libelle,
            'service_destinataire' => (string) $archive->serviceDestinataire?->libelle,
            'structure_origine' => (string) $archive->structureOrigine?->libelle,
            'structure_destinataire' => (string) $archive->structureDestinataire?->libelle,
            'niveau_confidentialite' => (string) $archive->niveauConfidentialite?->libelle,
            'courrier_type' => (string) $archive->courrierType?->libelle,
            'source' => (string) $archive->source?->libelle,
            'attachments' => $attachmentsText,
            'comments' => $commentsText,
        ];
    }

    private function archiveFieldLevenshteinScore(string $normalizedSearch, ?string $field, int $maxDistance): ?int
    {
        $normalizedField = $this->normalizeArchiveSearchText($field);

        if ($normalizedField === '') {
            return null;
        }

        if (str_contains($normalizedField, $normalizedSearch)) {
            return 0;
        }

        $searchTokens = $this->archiveSearchTokens($normalizedSearch);
        $fieldTokens = $this->archiveSearchTokens($normalizedField);
        $candidateTexts = $fieldTokens;
        $windowSize = count($searchTokens);

        if ($windowSize > 1 && count($fieldTokens) >= $windowSize) {
            for ($index = 0; $index <= count($fieldTokens) - $windowSize; $index++) {
                $candidateTexts[] = implode(' ', array_slice($fieldTokens, $index, $windowSize));
            }
        }

        if (strlen($normalizedField) <= 255) {
            $candidateTexts[] = $normalizedField;
        }

        $bestDistance = null;

        foreach (array_unique($candidateTexts) as $candidate) {
            if ($candidate === '' || abs(strlen($candidate) - strlen($normalizedSearch)) > $maxDistance) {
                continue;
            }

            $distance = $this->damerauLevenshtein($normalizedSearch, $candidate);

            if ($distance <= $maxDistance) {
                $bestDistance = $bestDistance === null ? $distance : min($bestDistance, $distance);
            }
        }

        return $bestDistance;
    }

    private function damerauLevenshtein(string $a, string $b): int
    {
        $lenA = strlen($a);
        $lenB = strlen($b);

        if ($lenA === 0) { return $lenB; }
        if ($lenB === 0) { return $lenA; }

        $d = [];
        for ($i = 0; $i <= $lenA; $i++) { $d[$i] = []; $d[$i][0] = $i; }
        for ($j = 0; $j <= $lenB; $j++) { $d[0][$j] = $j; }

        for ($i = 1; $i <= $lenA; $i++) {
            for ($j = 1; $j <= $lenB; $j++) {
                $cost = $a[$i - 1] === $b[$j - 1] ? 0 : 1;
                $d[$i][$j] = min(
                    $d[$i - 1][$j] + 1,
                    $d[$i][$j - 1] + 1,
                    $d[$i - 1][$j - 1] + $cost
                );
                if ($i > 1 && $j > 1 && $a[$i - 1] === $b[$j - 2] && $a[$i - 2] === $b[$j - 1]) {
                    $d[$i][$j] = min($d[$i][$j], $d[$i - 2][$j - 2] + $cost);
                }
            }
        }

        return $d[$lenA][$lenB];
    }

    private function normalizeArchiveSearchText(?string $value): string
    {
        $normalized = Str::ascii(Str::lower(trim((string) $value)));
        $normalized = preg_replace('/[^a-z0-9]+/', ' ', $normalized) ?? '';

        return trim(preg_replace('/\s+/', ' ', $normalized) ?? '');
    }

    private function archiveSearchTokens(string $value): array
    {
        return array_values(array_filter(explode(' ', $value), fn(string $token) => $token !== ''));
    }

    private function archiveLevenshteinMaxDistance(string $normalizedSearch): int
    {
        $length = strlen(str_replace(' ', '', $normalizedSearch));

        if ($length <= 3) {
            return 0;
        }

        if ($length <= 5) {
            return 1;
        }

        if ($length <= 8) {
            return 2;
        }

        if ($length <= 12) {
            return 3;
        }

        if ($length <= 16) {
            return 4;
        }

        return 5;
    }

    private function applyArchiveExactDateFilter(Builder $query, string $column, ?string $date): void
    {
        $normalized = $this->normalizeArchiveDate($date);

        if ($normalized !== null) {
            $query->whereDate($column, $normalized);
        }
    }

    private function applyArchiveDateRangeFilter(Builder $query, string $column, ?string $from, ?string $to): void
    {
        $normalizedFrom = $this->normalizeArchiveDate($from);
        $normalizedTo = $this->normalizeArchiveDate($to);

        if ($normalizedFrom && $normalizedTo) {
            $query->whereBetween($column, [
                \Carbon\Carbon::parse($normalizedFrom)->startOfDay(),
                \Carbon\Carbon::parse($normalizedTo)->endOfDay(),
            ]);
            return;
        }

        if ($normalizedFrom) {
            $query->where($column, '>=', \Carbon\Carbon::parse($normalizedFrom)->startOfDay());
        }

        if ($normalizedTo) {
            $query->where($column, '<=', \Carbon\Carbon::parse($normalizedTo)->endOfDay());
        }
    }

    private function normalizeArchiveDate(?string $date): ?string
    {
        if (!$date) {
            return null;
        }

        try {
            return \Carbon\Carbon::parse($date)->toDateString();
        } catch (\Throwable) {
            return null;
        }
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

    private function courrierListRelations(): array
    {
        return [
            'courrierType',
            'niveauConfidentialite',
            'createur',
            'serviceSource.structure',
            'serviceDestinataire.structure',
            'source',
            'attachments',
            'recipients',
            'reponses',
        ];
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
            'courrierType',
            'niveauConfidentialite',
            'createur',
            'valideur',
            'source',
            'serviceSource.structure',
            'serviceDestinataire.structure',
            'structureOrigine',
            'structureDestinataire',
            'transmisPar',
            'archivePar',
        ];
    }
}
