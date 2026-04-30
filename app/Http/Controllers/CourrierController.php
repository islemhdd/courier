<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreCourrierRequest;
use App\Http\Requests\UpdateCourrierRequest;
use App\Models\Archive;
use App\Models\Courrier;
use App\Models\NiveauConfidentialite;
use App\Models\Service;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class CourrierController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return $this->respondWithCourriers($request);
    }

    public function recus(Request $request): JsonResponse
    {
        return $this->respondWithCourriers($request, false, [
            'statut' => Courrier::STATUT_RECU,
        ]);
    }

    public function envoyes(Request $request): JsonResponse
    {
        return $this->respondWithCourriers($request, false, [
            'type' => Courrier::TYPE_SORTANT,
        ]);
    }

    public function archives(Request $request): JsonResponse
    {
        $user = $request->user();
        $filtres = $request->only([
            'q',
            'numero',
            'objet',
            'expediteur',
            'destinataire',
            'type',
            'niveau_confidentialite_id',
            'date_reception',
            'statut_original',
        ]);

        $query = Archive::with([
            'niveauConfidentialite',
            'createur',
            'valideur',
            'serviceSource',
            'serviceDestinataire',
            'transmisPar',
            'archivePar',
        ])
            ->visiblePourUser($user)
            ->when($filtres['q'] ?? null, function ($query, $value) {
                $query->where(function ($subQuery) use ($value) {
                    $subQuery->where('numero', 'like', '%' . $value . '%')
                        ->orWhere('objet', 'like', '%' . $value . '%')
                        ->orWhere('expediteur', 'like', '%' . $value . '%')
                        ->orWhere('destinataire', 'like', '%' . $value . '%');
                });
            })
            ->when($filtres['numero'] ?? null, fn($q, $v) => $q->where('numero', 'like', '%' . $v . '%'))
            ->when($filtres['objet'] ?? null, fn($q, $v) => $q->where('objet', 'like', '%' . $v . '%'))
            ->when($filtres['expediteur'] ?? null, fn($q, $v) => $q->where('expediteur', 'like', '%' . $v . '%'))
            ->when($filtres['destinataire'] ?? null, fn($q, $v) => $q->where('destinataire', 'like', '%' . $v . '%'))
            ->when($filtres['type'] ?? null, fn($q, $v) => $q->where('type', $v))
            ->when($filtres['niveau_confidentialite_id'] ?? null, fn($q, $v) => $q->where('niveau_confidentialite_id', $v))
            ->when($filtres['statut_original'] ?? null, fn($q, $v) => $q->where('statut_original', $v))
            ->when($filtres['date_reception'] ?? null, function ($query, $value) {
                $this->applyDateReceptionFilter($query, $value);
            })
            ->orderBy('archive_le', 'desc');

        $archives = $query->paginate(15);

        $archives->getCollection()->transform(function (Archive $archive) use ($user) {
            return $this->enrichArchive($archive, $user);
        });

        return response()->json([
            'archives' => $archives,
            'courriers' => $archives,
            'filtres' => $filtres,
        ]);
    }

    public function validation(Request $request): JsonResponse
    {
        return $this->respondWithCourriers($request, true);
    }

    public function create(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user->peutCreerCourrier()) {
            return response()->json([
                'error' => 'Vous n\'avez pas le droit de creer des courriers.',
            ], 403);
        }

        $niveaux = NiveauConfidentialite::where('rang', '<=', $user->getRangNiveauConfidentialite())
            ->orderBy('rang')
            ->get();

        return response()->json([
            'niveaux_confidentialite' => $niveaux,
            'services' => Service::orderBy('libelle')->get(),
            'types' => [
                ['value' => 'entrant', 'label' => 'Entrant'],
                ['value' => 'sortant', 'label' => 'Sortant'],
            ],
        ]);
    }

    public function store(StoreCourrierRequest $request): JsonResponse
    {
        $user = $request->user();

        if (!$user->peutCreerCourrier()) {
            return response()->json([
                'error' => 'Vous n\'avez pas le droit de creer des courriers.',
            ], 403);
        }

        $donnees = $request->validated();
        $type = $donnees['type'] ?? null;
        $serviceDestinataire = $this->resolveServiceDestinataire($donnees);

        if ($type === Courrier::TYPE_ENTRANT) {
            // For received courriers, the recipient service is the current user's service
            // (admin can optionally choose another service).
            if (!$user->estAdmin()) {
                $serviceDestinataire = $user->service_id ? Service::find($user->service_id) : null;
            }
        }

        $donnees['numero'] = 'COUR-' . date('Y') . '-' . strtoupper(substr(uniqid(), -8));
        if ($user->estSecretaire()) {
            $donnees['statut'] = Courrier::STATUT_CREE;
        } elseif ($type === Courrier::TYPE_ENTRANT) {
            $donnees['statut'] = Courrier::STATUT_RECU;
        } else {
            $donnees['statut'] = Courrier::STATUT_VALIDE;
        }
        $donnees['date_creation'] = now();
        $donnees['createur_id'] = $user->id;
        $donnees['service_source_id'] = $type === Courrier::TYPE_SORTANT ? $user->service_id : null;
        $donnees['service_destinataire_id'] = $serviceDestinataire?->id;
        $donnees['transmission_demandee'] = $type === Courrier::TYPE_SORTANT
            ? (bool) ($donnees['transmission_directe'] ?? false)
            : false;
        unset($donnees['transmission_directe']);

        if (($donnees['type'] ?? null) === Courrier::TYPE_SORTANT) {
            $donnees['expediteur'] = $donnees['expediteur']
                ?? $user->service?->libelle
                ?? $user->nom_complet
                ?? $user->name
                ?? 'Interne';
            $donnees['destinataire'] = $donnees['destinataire'] ?? $serviceDestinataire?->libelle;
        }

        if (($donnees['type'] ?? null) === Courrier::TYPE_ENTRANT) {
            $donnees['destinataire'] = $donnees['destinataire']
                ?? $serviceDestinataire?->libelle
                ?? $user->service?->libelle
                ?? $user->nom_complet
                ?? $user->name
                ?? 'Interne';
        }

        if ($request->hasFile('fichier')) {
            $donnees['chemin_fichier'] = $request->file('fichier')->store('courriers', 'public');
        }

        $resultatTransmission = null;

        $courrier = DB::transaction(function () use ($donnees, $user, $serviceDestinataire, &$resultatTransmission) {
            $courrier = Courrier::create($donnees);
            $courrier->load($this->courrierRelations());

            if ($courrier->transmission_demandee && $courrier->estValide()) {
                $resultatTransmission = $this->transmettreEtArchiver($courrier, $user, $serviceDestinataire);
                return null;
            }

            return $courrier;
        });

        if ($resultatTransmission) {
            return response()->json([
                'message' => 'Courrier valide, transmis et archive automatiquement.',
                'archive' => $this->enrichArchive($resultatTransmission['archive'], $user),
                'courrier_recu' => $resultatTransmission['courrier_recu']
                    ? $this->enrichCourrier($resultatTransmission['courrier_recu'], $user)
                    : null,
            ], 201);
        }

        $courrier->load($this->courrierRelations());

        return response()->json([
            'message' => $courrier->transmission_demandee
                ? 'Courrier cree et soumis pour validation avant transmission.'
                : 'Courrier cree avec succes.',
            'courrier' => $this->enrichCourrier($courrier, $user),
        ], 201);
    }

    public function show(Courrier $courrier, Request $request): JsonResponse
    {
        $user = $request->user();
        $courrier->load($this->courrierRelations());

        if (!$user || !$courrier->peutVoirExistencePar($user)) {
            return response()->json([
                'error' => 'Vous n\'avez pas le droit de voir ce courrier.',
            ], 403);
        }

        return response()->json([
            'courrier' => $this->enrichCourrier($courrier, $user),
        ]);
    }

    public function update(UpdateCourrierRequest $request, Courrier $courrier): JsonResponse
    {
        $user = $request->user();
        $courrier->load($this->courrierRelations());
        $validated = $request->validated();

        unset(
            $validated['numero'],
            $validated['statut'],
            $validated['date_creation'],
            $validated['date_reception'],
            $validated['createur_id'],
            $validated['valideur_id'],
            $validated['transmis_par_id'],
            $validated['transmis_le'],
            $validated['transmission_demandee'],
            $validated['service_source_id']
        );

        $serviceDestinataire = $this->resolveServiceDestinataire($validated);
        if ($serviceDestinataire && empty($validated['destinataire'])) {
            $validated['destinataire'] = $serviceDestinataire->libelle;
        }

        if (($validated['type'] ?? $courrier->type) === Courrier::TYPE_SORTANT && empty($validated['expediteur'])) {
            $validated['expediteur'] = $courrier->expediteur
                ?: $user->service?->libelle
                ?: $user->nom_complet
                ?: $user->name
                ?: 'Interne';
        }

        if (($validated['type'] ?? $courrier->type) === Courrier::TYPE_ENTRANT && empty($validated['destinataire'])) {
            $validated['destinataire'] = $courrier->destinataire
                ?: $user->service?->libelle
                ?: $user->nom_complet
                ?: $user->name
                ?: 'Interne';
        }

        if ($request->hasFile('fichier')) {
            if ($courrier->chemin_fichier) {
                Storage::disk('public')->delete($courrier->chemin_fichier);
            }

            $validated['chemin_fichier'] = $request->file('fichier')->store('courriers', 'public');
        }

        $courrier->update($validated);
        $courrier->load($this->courrierRelations());

        return response()->json([
            'message' => 'Courrier modifie avec succes.',
            'courrier' => $this->enrichCourrier($courrier, $user),
        ]);
    }

    public function destroy(Courrier $courrier, Request $request): JsonResponse
    {
        $user = $request->user();
        $courrier->load($this->courrierRelations());

        if (!$courrier->peutEtreSupprimePar($user)) {
            return response()->json([
                'error' => 'Seul le secretaire createur peut supprimer un courrier a l\'etat CREE ou NON_VALIDE. Un courrier VALIDE, TRANSMIS, RECU ou ARCHIVE ne peut pas etre supprime.',
            ], 403);
        }

        if ($courrier->chemin_fichier) {
            Storage::disk('public')->delete($courrier->chemin_fichier);
        }

        $courrier->delete();

        return response()->json([
            'message' => 'Courrier supprime avec succes.',
        ]);
    }

    public function destroyArchive(Archive $archive, Request $request): JsonResponse
    {
        $user = $request->user();
        $archive->load($this->archiveRelations());

        if (!$archive->peutEtreSupprimePar($user)) {
            return response()->json([
                'error' => 'Seul un administrateur peut supprimer une archive.',
            ], 403);
        }

        if ($archive->chemin_fichier) {
            Storage::disk('public')->delete($archive->chemin_fichier);
        }

        $archive->delete();

        return response()->json([
            'message' => 'Archive supprimee avec succes.',
        ]);
    }

    public function archiver(Courrier $courrier, Request $request): JsonResponse
    {
        $user = $request->user();
        $courrier->load($this->courrierRelations());

        if (!$courrier->peutEtreArchivePar($user)) {
            return response()->json([
                'error' => 'On ne peut archiver que les courriers TRANSMIS ou RECU dans votre perimetre.',
            ], 403);
        }

        $archive = DB::transaction(fn() => $this->archiverCourrier(
            $courrier,
            $user,
            'Archivage manuel'
        ));

        return response()->json([
            'message' => 'Courrier copie dans les archives puis supprime de la table courriers.',
            'archive' => $this->enrichArchive($archive, $user),
        ]);
    }

    public function transmettre(Courrier $courrier, Request $request): JsonResponse
    {
        $user = $request->user();
        $courrier->load($this->courrierRelations());

        $validated = $request->validate([
            'service_destinataire_id' => ['nullable', 'integer', 'exists:services,id'],
            'destinataire' => ['nullable', 'string', 'max:100'],
        ]);

        if (!$courrier->peutEtreTransmisPar($user)) {
            return response()->json([
                'error' => 'Le courrier doit etre VALIDE avant transmission, et vous devez etre createur, chef du service ou admin.',
            ], 403);
        }

        $serviceDestinataire = $this->resolveServiceDestinataire($validated)
            ?? $courrier->serviceDestinataire;

        if (!$serviceDestinataire && empty($validated['destinataire']) && empty($courrier->destinataire)) {
            return response()->json([
                'error' => 'Indiquez un service destinataire ou un destinataire.',
            ], 422);
        }

        $resultat = DB::transaction(fn() => $this->transmettreEtArchiver(
            $courrier,
            $user,
            $serviceDestinataire,
            $validated['destinataire'] ?? null
        ));

        return response()->json([
            'message' => 'Courrier transmis et archive automatiquement.',
            'archive' => $this->enrichArchive($resultat['archive'], $user),
            'courrier_recu' => $resultat['courrier_recu']
                ? $this->enrichCourrier($resultat['courrier_recu'], $user)
                : null,
        ]);
    }

    public function valider(Courrier $courrier, Request $request): JsonResponse
    {
        $user = $request->user();
        $courrier->load($this->courrierRelations());

        if (!$courrier->estValidable()) {
            return response()->json([
                'error' => 'Ce courrier ne peut plus etre valide.',
            ], 422);
        }

        if (!$courrier->peutEtreValidePar($user)) {
            return response()->json([
                'error' => 'Vous n\'avez pas le droit de valider ce courrier.',
            ], 403);
        }

        $resultatTransmission = null;

        DB::transaction(function () use ($courrier, $user, &$resultatTransmission) {
            $nouveauStatut = $courrier->type === Courrier::TYPE_ENTRANT
                ? Courrier::STATUT_RECU
                : Courrier::STATUT_VALIDE;

            $courrier->update([
                'statut' => $nouveauStatut,
                'valideur_id' => $user->id,
            ]);
            $courrier->refresh()->load($this->courrierRelations());

            if ($courrier->type === Courrier::TYPE_SORTANT && $courrier->transmission_demandee) {
                $resultatTransmission = $this->transmettreEtArchiver(
                    $courrier,
                    $user,
                    $courrier->serviceDestinataire
                );
            }
        });

        if ($resultatTransmission) {
            return response()->json([
                'message' => 'Courrier valide, transmis et archive automatiquement.',
                'archive' => $this->enrichArchive($resultatTransmission['archive'], $user),
                'courrier_recu' => $resultatTransmission['courrier_recu']
                    ? $this->enrichCourrier($resultatTransmission['courrier_recu'], $user)
                    : null,
            ]);
        }

        $courrier->load($this->courrierRelations());

        return response()->json([
            'message' => 'Courrier valide avec succes.',
            'courrier' => $this->enrichCourrier($courrier, $user),
        ]);
    }

    public function nonValider(Courrier $courrier, Request $request): JsonResponse
    {
        $user = $request->user();
        $courrier->load($this->courrierRelations());

        if (!$courrier->estValidable()) {
            return response()->json([
                'error' => 'Ce courrier ne peut plus etre marque comme non valide.',
            ], 422);
        }

        if (!$courrier->peutEtreNonValidePar($user)) {
            return response()->json([
                'error' => 'Vous n\'avez pas le droit de marquer ce courrier comme non valide.',
            ], 403);
        }

        $courrier->update([
            'statut' => Courrier::STATUT_NON_VALIDE,
            'valideur_id' => $user->id,
        ]);

        $courrier->refresh()->load($this->courrierRelations());

        return response()->json([
            'message' => 'Courrier marque comme non valide.',
            'courrier' => $this->enrichCourrier($courrier, $user),
        ]);
    }

    private function respondWithCourriers(
        Request $request,
        bool $onlyValidation = false,
        array $forcedFilters = []
    ): JsonResponse {
        $user = $request->user();
        $filtres = array_merge($request->only([
            'q',
            'numero',
            'objet',
            'expediteur',
            'destinataire',
            'statut',
            'type',
            'niveau_confidentialite_id',
            'date_reception',
        ]), $forcedFilters);

        $query = Courrier::with($this->courrierRelations())
            ->visiblePourUser($user)
            ->when($onlyValidation, fn($q) => $q->validablesPourUser($user))
            ->when($filtres['q'] ?? null, function ($query, $value) {
                $query->where(function ($subQuery) use ($value) {
                    $subQuery->where('numero', 'like', '%' . $value . '%')
                        ->orWhere('objet', 'like', '%' . $value . '%')
                        ->orWhere('expediteur', 'like', '%' . $value . '%')
                        ->orWhere('destinataire', 'like', '%' . $value . '%');
                });
            })
            ->when($filtres['numero'] ?? null, fn($q, $v) => $q->numero($v))
            ->when($filtres['objet'] ?? null, fn($q, $v) => $q->objet($v))
            ->when($filtres['expediteur'] ?? null, fn($q, $v) => $q->expediteur($v))
            ->when($filtres['destinataire'] ?? null, fn($q, $v) => $q->destinataire($v))
            ->when($filtres['type'] ?? null, fn($q, $v) => $q->type($v))
            ->when($filtres['niveau_confidentialite_id'] ?? null, fn($q, $v) => $q->niveauConfidentialite($v))
            ->when($filtres['date_reception'] ?? null, fn($q, $v) => $q->dateReception($v))
            ->orderBy('date_creation', 'desc');

        if (!$onlyValidation && !empty($filtres['statut'])) {
            $query->statut($filtres['statut']);
        }

        $courriers = $query->paginate(5);

        $courriers->getCollection()->transform(function (Courrier $courrier) use ($user) {
            return $this->enrichCourrier($courrier, $user);
        });

        return response()->json([
            'courriers' => $courriers,
            'filtres' => $filtres,
        ]);
    }

    private function transmettreEtArchiver(
        Courrier $courrier,
        User $user,
        ?Service $serviceDestinataire,
        ?string $destinataireLibre = null
    ): array {
        $destinataire = $destinataireLibre
            ?: $serviceDestinataire?->libelle
            ?: $courrier->destinataire;

        $courrier->update([
            'statut' => Courrier::STATUT_TRANSMIS,
            'service_destinataire_id' => $serviceDestinataire?->id ?? $courrier->service_destinataire_id,
            'destinataire' => $destinataire,
            'transmis_par_id' => $user->id,
            'transmis_le' => now(),
            'transmission_demandee' => false,
        ]);

        $courrier->refresh()->load($this->courrierRelations());

        $courrierRecu = null;
        if ($serviceDestinataire) {
            $courrierRecu = Courrier::create([
                'numero' => $this->genererNumeroCourrier(),
                'objet' => $courrier->objet,
                'type' => Courrier::TYPE_ENTRANT,
                'chemin_fichier' => $courrier->chemin_fichier,
                'date_creation' => now(),
                'date_reception' => now(),
                'expediteur' => $courrier->serviceSource?->libelle ?? $courrier->expediteur,
                'destinataire' => $serviceDestinataire->libelle,
                'statut' => Courrier::STATUT_RECU,
                'transmission_demandee' => false,
                'service_source_id' => $courrier->service_source_id,
                'service_destinataire_id' => $serviceDestinataire->id,
                'niveau_confidentialite_id' => $courrier->niveau_confidentialite_id,
                'createur_id' => $courrier->createur_id,
                'valideur_id' => $courrier->valideur_id,
                'transmis_par_id' => $user->id,
                'transmis_le' => $courrier->transmis_le,
            ]);
            $courrierRecu->load($this->courrierRelations());
        }

        $archive = $this->archiverCourrier(
            $courrier,
            $user,
            'Archivage automatique apres transmission'
        );

        return [
            'archive' => $archive,
            'courrier_recu' => $courrierRecu,
        ];
    }

    private function archiverCourrier(Courrier $courrier, User $user, string $motif): Archive
    {
        if (!$courrier->estArchivable()) {
            abort(422, 'On ne peut archiver que les courriers TRANSMIS ou RECU.');
        }

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
        $courrier->contenu_restreint = !$courrier->peut_voir_details;

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
            $archive->objet = 'Contenu restreint';
            $archive->expediteur = 'Acces restreint';
            $archive->destinataire = 'Acces restreint';
            $archive->chemin_fichier = null;
        }

        return $archive;
    }

    private function resolveServiceDestinataire(array $donnees): ?Service
    {
        if (empty($donnees['service_destinataire_id'])) {
            return null;
        }

        return Service::find($donnees['service_destinataire_id']);
    }

    private function genererNumeroCourrier(): string
    {
        return 'COUR-' . date('Y') . '-' . strtoupper(substr(uniqid(), -8));
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

    private function courrierRelations(): array
    {
        return [
            'niveauConfidentialite',
            'createur',
            'valideur',
            'serviceSource',
            'serviceDestinataire',
            'transmisPar',
        ];
    }

    private function archiveRelations(): array
    {
        return [
            'niveauConfidentialite',
            'createur',
            'valideur',
            'serviceSource',
            'serviceDestinataire',
            'transmisPar',
            'archivePar',
        ];
    }
}
