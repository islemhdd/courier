<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreCourrierRequest;
use App\Http\Requests\UpdateCourrierRequest;
use App\Models\Courrier;
use App\Models\NiveauConfidentialite;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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
            'type' => Courrier::TYPE_ENTRANT,
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
        return $this->respondWithCourriers($request, false, [
            'statut' => Courrier::STATUT_ARCHIVE,
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
                'error' => 'Vous n\'avez pas le droit de créer des courriers.'
            ], 403);
        }

        $niveaux = NiveauConfidentialite::where('rang', '<=', $user->getRangNiveauConfidentialite())
            ->orderBy('rang')
            ->get();

        return response()->json([
            'niveaux_confidentialite' => $niveaux,
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
                'error' => 'Vous n\'avez pas le droit de créer des courriers.'
            ], 403);
        }

        $donnees = $request->validated();

        if (($donnees['type'] ?? null) === Courrier::TYPE_SORTANT) {
            $donnees['expediteur'] = $donnees['expediteur']
                ?? $user->service?->libelle
                ?? $user->nom_complet
                ?? $user->name
                ?? 'Interne';
        }

        if (($donnees['type'] ?? null) === Courrier::TYPE_ENTRANT) {
            $donnees['destinataire'] = $donnees['destinataire']
                ?? $user->service?->libelle
                ?? $user->nom_complet
                ?? $user->name
                ?? 'Interne';
        }

        $donnees['numero'] = 'COUR-' . date('Y') . '-' . strtoupper(substr(uniqid(), -8));
         $donnees['statut'] = Courrier::STATUT_NON_VALIDE;
        $donnees['date_creation'] = now();
        $donnees['createur_id'] = $user->id;

        if ($request->hasFile('fichier')) {
            $donnees['chemin_fichier'] = $request->file('fichier')->store('courriers', 'public');
        }

        $courrier = Courrier::create($donnees);
        $courrier->load(['niveauConfidentialite', 'createur', 'valideur']);

        return response()->json([
            'message' => 'Courrier créé avec succès.',
            'courrier' => $this->enrichCourrier($courrier, $user),
        ], 201);
    }

    public function show(Courrier $courrier, Request $request): JsonResponse
    {
        $user = $request->user();

        $courrier->load(['niveauConfidentialite', 'createur', 'valideur']);

        if (!$user || !$courrier->peutVoirExistencePar($user)) {
            return response()->json([
                'error' => 'Vous n\'avez pas le droit de voir ce courrier.'
            ], 403);
        }

        return response()->json([
            'courrier' => $this->enrichCourrier($courrier, $user),
        ]);
    }

  public function update(UpdateCourrierRequest $request, Courrier $courrier): JsonResponse
{
    $user = $request->user();

    if (!$user) {
        return response()->json([
            'error' => 'Vous devez être connecté.'
        ], 401);
    }

    $courrier->load(['createur', 'niveauConfidentialite', 'valideur']);

    if (!$courrier->peutEtreModifiePar($user)) {
        return response()->json([
            'error' => 'Vous n\'avez pas le droit de modifier ce courrier.'
        ], 403);
    }

    $validated = $request->validated();

    // Champs protégés : on ne les modifie jamais depuis le formulaire.
    unset(
        $validated['numero'],
        $validated['statut'],
        $validated['date_creation'],
        $validated['date_reception'],
        $validated['createur_id'],
        $validated['valideur_id']
    );

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
    $courrier->load(['niveauConfidentialite', 'createur', 'valideur']);

    return response()->json([
        'message' => 'Courrier modifié avec succès.',
        'courrier' => $this->enrichCourrier($courrier, $user),
    ]);
}
      public function destroy(Courrier $courrier, Request $request): JsonResponse
{
    $user = $request->user();

    if (!$user) {
        return response()->json([
            'error' => 'Vous devez être connecté.'
        ], 401);
    }

    $courrier->load(['createur', 'niveauConfidentialite', 'valideur']);

    if ($courrier->estValide() || $courrier->estArchive()) {
        return response()->json([
            'error' => 'Un courrier validé ou archivé ne peut jamais être supprimé.'
        ], 422);
    }

    if (!$courrier->peutEtreSupprimePar($user)) {
        return response()->json([
            'error' => 'Vous n\'avez pas le droit de supprimer ce courrier.'
        ], 403);
    }

    if ($courrier->chemin_fichier) {
        Storage::disk('public')->delete($courrier->chemin_fichier);
    }

    $courrier->delete();

    return response()->json([
        'message' => 'Courrier supprimé avec succès.',
    ]);
}

    
    public function archiver(Courrier $courrier, Request $request): JsonResponse
    {
        $user = $request->user();

        if ($courrier->statut === Courrier::STATUT_ARCHIVE) {
            return response()->json([
                'error' => 'Ce courrier est déjà archivé.'
            ], 422);
        }

        if (!$courrier->peutEtreArchivePar($user)) {
            return response()->json([
                'error' => 'Vous n\'avez pas le droit d\'archiver ce courrier.'
            ], 403);
        }

        $courrier->update([
            'statut' => Courrier::STATUT_ARCHIVE,
        ]);

        $courrier->load(['niveauConfidentialite', 'createur', 'valideur']);

        return response()->json([
            'message' => 'Courrier archivé avec succès.',
            'courrier' => $this->enrichCourrier($courrier, $user),
        ]);
    }

    public function valider(Courrier $courrier, Request $request): JsonResponse
    {
        $user = $request->user();

        $courrier->load(['createur', 'niveauConfidentialite', 'valideur']);

        if (!$courrier->estValidable()) {
            return response()->json([
                'error' => 'Ce courrier ne peut plus être validé.'
            ], 422);
        }

        if (!$courrier->peutEtreValidePar($user)) {
            return response()->json([
                'error' => 'Vous n\'avez pas le droit de valider ce courrier.'
            ], 403);
        }

        $courrier->update([
            'statut' => Courrier::STATUT_VALIDE,
            'valideur_id' => $user->id,
        ]);

        $courrier->load(['niveauConfidentialite', 'createur', 'valideur']);

        return response()->json([
            'message' => 'Courrier validé avec succès.',
            'courrier' => $this->enrichCourrier($courrier, $user),
        ]);
    }

    private function respondWithCourriers(
        Request $request,
        bool $onlyValidation = false,
        array $forcedFilters = []
    ): JsonResponse
    {
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

        $query = Courrier::with(['niveauConfidentialite', 'createur', 'valideur'])
            ->visiblePourUser($user)
            ->when($onlyValidation, fn($q) => $q->enValidation())
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

        $courriers = $query->paginate(15);

        $courriers->getCollection()->transform(function (Courrier $courrier) use ($user) {
            return $this->enrichCourrier($courrier, $user);
        });

        return response()->json([
            'courriers' => $courriers,
            'filtres' => $filtres,
        ]);
    }

      private function enrichCourrier(Courrier $courrier, $user): Courrier
{
    $courrier->peut_voir_details = $user ? $this->userPeutVoirDetails($user, $courrier) : false;
    $courrier->peut_voir_existence = $user ? $courrier->peutVoirExistencePar($user) : false;
    $courrier->peut_etre_valide = $user ? $courrier->peutEtreValidePar($user) : false;
    $courrier->peut_etre_modifie = $user ? $courrier->peutEtreModifiePar($user) : false;
    $courrier->peut_etre_supprime = $user ? $courrier->peutEtreSupprimePar($user) : false;
    $courrier->contenu_restreint = !$courrier->peut_voir_details;

    if (!$courrier->peut_voir_details) {
        $courrier->objet = 'Contenu restreint';
        $courrier->expediteur = 'Accès restreint';
        $courrier->destinataire = 'Accès restreint';

        // Important : éviter que l’URL du fichier sorte dans l’API.
        $courrier->chemin_fichier = null;
    }

    return $courrier;
}

    private function userPeutVoirDetails($user, Courrier $courrier): bool
    {
        if (!$user) {
            return false;
        }

        return $courrier->peutEtreVuEnDetailPar($user);
    }
}
