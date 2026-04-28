<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreCourrierRequest;
use App\Http\Requests\UpdateCourrierRequest;
use App\Models\Courrier;
use App\Models\NiveauConfidentialite;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;


/**
 * Contrôleur pour la gestion des courriers.
 * Toutes les réponses sont au format JSON pour l'API.
 */
class CourrierController extends Controller
{
    /**
     * Affiche la liste paginée des courriers avec filtres.
     * Les règles de visibilité sont appliquées via le scope scopeVisiblePourUser.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        // Récupérer les filtres
        $filtres = $request->only([
            'q',
            'numero',
            'objet',
            'expediteur',
            'destinataire',
            'statut',
            'type',
            'niveau_confidentialite_id',
            'date_reception'
        ]);

        // Construire la requête avec les scopes
        $courriers = Courrier::with(['niveauConfidentialite', 'createur', 'valideur'])
            ->visiblePourUser($user)
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
            ->when($filtres['statut'] ?? null, fn($q, $v) => $q->statut($v))
            ->when($filtres['type'] ?? null, fn($q, $v) => $q->type($v))
            ->when($filtres['niveau_confidentialite_id'] ?? null, fn($q, $v) => $q->niveauConfidentialite($v))
            ->when($filtres['date_reception'] ?? null, fn($q, $v) => $q->dateReception($v))
            ->orderBy('date_creation', 'desc')
            ->paginate(15);

        // Pour chaque courrier, vérifier si l'utilisateur peut voir les détails complets
        $courriers->getCollection()->transform(function ($courrier) use ($user) {
            $courrier->peut_voir_details = $this->userPeutVoirDetails($user, $courrier);
            return $courrier;
        });

        return response()->json([
            'courriers' => $courriers,
            'filtres' => $filtres,
        ]);
    }

    /**
     * Vérifie si l'utilisateur peut voir les détails complets d'un courrier.
     */
    public function recus(Request $request): JsonResponse
    {
        $request->merge(['type' => Courrier::TYPE_ENTRANT]);

        return $this->index($request);
    }

    public function envoyes(Request $request): JsonResponse
    {
        $request->merge(['type' => Courrier::TYPE_SORTANT]);

        return $this->index($request);
    }

    private function userPeutVoirDetails($user, Courrier $courrier): bool
{
    if (!$user) {
        return false;
    }

    if ($user->estAdmin()) {
        return true;
    }

    if (!$courrier->relationLoaded('niveauConfidentialite')) {
        $courrier->load('niveauConfidentialite');
    }

    if (!$courrier->relationLoaded('createur')) {
        $courrier->load('createur');
    }

    $rangCourrier = $courrier->niveauConfidentialite?->rang ?? 0;
    $rangUser = $user->getRangNiveauConfidentialite();

    if ($rangCourrier > $rangUser) {
        return false;
    }

    if ($user->estChef()) {
        return $courrier->createur
            && $courrier->createur->service_id === $user->service_id;
    }

    if ($user->estSecretaire()) {
        return $courrier->createur_id === $user->id || $rangCourrier <= $rangUser;
    }

    return false;
}


public function update(Request $request, Courrier $courrier): JsonResponse
{
    $user = $request->user();

    if (!$user) {
        return response()->json([
            'error' => 'Vous devez être connecté.'
        ], 401);
    }

    if ($courrier->createur_id !== $user->id && !$user->estAdmin()) {
        return response()->json([
            'error' => 'Vous n\'avez pas le droit de modifier ce courrier.'
        ], 403);
    }

    if ($courrier->statut === Courrier::STATUT_ARCHIVE) {
        return response()->json([
            'error' => 'Impossible de modifier un courrier archivé.'
        ], 422);
    }

    $validated = $request->validate([
        'objet' => ['required', 'string', 'max:100'],
        'type' => ['required', 'in:entrant,sortant'],

        'expediteur' => ['nullable', 'string', 'max:100'],
        'destinataire' => ['nullable', 'string', 'max:100'],

        'niveau_confidentialite_id' => [
            'required',
            'integer',
            'exists:niveau_confidentialites,id',
        ],

        'fichier' => [
            'nullable',
            'file',
            'mimes:pdf,doc,docx,jpg,jpeg,png',
            'max:10240',
        ],
    ]);

    // Sécurité : la date d'envoi ne doit jamais être modifiée.
    unset($validated['date_reception']);

    if ($request->hasFile('fichier')) {
        if ($courrier->chemin_fichier) {
            Storage::disk('public')->delete($courrier->chemin_fichier);
        }

        $validated['chemin_fichier'] = $request
            ->file('fichier')
            ->store('courriers', 'public');
    }

    $courrier->update($validated);

    $courrier->load(['niveauConfidentialite', 'createur', 'valideur']);

    return response()->json([
        'message' => 'Courrier modifié avec succès.',
        'courrier' => $courrier,
    ]);
}
    /**
     * Retourne les données nécessaires pour le formulaire de création.
     */
    public function create(Request $request): JsonResponse
    {
        $user = $request->user();

        // Vérifier les droits de création
        if (!$user->peutCreerCourrier()) {
            return response()->json([
                'error' => 'Vous n\'avez pas le droit de créer des courriers.'
            ], 403);
        }

        // Récupérer les niveaux de confidentialité accessibles (rang <= au sien)
        $niveaux = NiveauConfidentialite::where('rang', '<=', $user->getRangNiveauConfidentialite())
            ->orderBy('rang')
            ->get();

        $types = [
            ['value' => 'entrant', 'label' => 'Entrant'],
            ['value' => 'sortant', 'label' => 'Sortant'],
        ];

        return response()->json([
            'niveaux_confidentialite' => $niveaux,
            'types' => $types,
        ]);
    }

    /**
     * Enregistre un nouveau courrier.
     */
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

    if ($request->hasFile('fichier')) {
        $donnees['chemin_fichier'] = $request
            ->file('fichier')
            ->store('courriers', 'public');
    }

    $donnees['statut'] = Courrier::STATUT_CREE;
    $donnees['date_creation'] = now();
    $donnees['createur_id'] = $user->id;

    $courrier = Courrier::create($donnees);

    $courrier->load(['niveauConfidentialite', 'createur', 'valideur']);

    return response()->json([
        'message' => 'Courrier créé avec succès.',
        'courrier' => $courrier,
    ], 201);
}
    /**
     * Affiche les détails d'un courrier.
     */
    public function show(Courrier $courrier, Request $request): JsonResponse
{
    $user = $request->user();

    $courrier->load(['niveauConfidentialite', 'createur', 'valideur']);

    if (!$this->userPeutVoirDetails($user, $courrier)) {
        return response()->json([
            'error' => 'Vous n\'avez pas le droit de voir ce courrier.'
        ], 403);
    }

    return response()->json([
        'courrier' => $courrier,
    ]);
}
   

    /**
     * Met à jour un courrier existant.
     */
      

    /**
     * Supprime un courrier.
     */
      public function destroy(Courrier $courrier, Request $request): JsonResponse
{
    $user = $request->user();

    if ($courrier->createur_id !== $user->id && !$user->estAdmin()) {
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
    /**
     * Archive un courrier.
     * Accessible à l'admin et au créateur du courrier.
     */
     public function archiver(Courrier $courrier, Request $request): JsonResponse
{
    $user = $request->user();

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
        'courrier' => $courrier,
    ]);
}
    /**
     * Valide un courrier.
     * Accessible au chef dont le service correspond au créateur.
     */
     public function valider(Courrier $courrier, Request $request): JsonResponse
{
    $user = $request->user();

    $courrier->load('createur');

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
        'courrier' => $courrier,
    ]);
}

}
