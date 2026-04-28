<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreCourrierRequest;
use App\Http\Requests\UpdateCourrierRequest;
use App\Models\Courrier;
use App\Models\NiveauConfidentialite;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

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
            'numero',
            'objet',
            'expediteur',
            'statut',
            'type',
            'niveau_confidentialite_id',
            'date_reception'
        ]);

        // Construire la requête avec les scopes
        $courriers = Courrier::with(['niveauConfidentialite', 'createur', 'valideur'])
            ->visiblePourUser($user)
            ->when($filtres['numero'] ?? null, fn($q, $v) => $q->numero($v))
            ->when($filtres['objet'] ?? null, fn($q, $v) => $q->objet($v))
            ->when($filtres['expediteur'] ?? null, fn($q, $v) => $q->expediteur($v))
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
    private function userPeutVoirDetails($user, Courrier $courrier): bool
    {
        if (!$user) {
            return false;
        }

        // L'admin a toujours accès
        if ($user->estAdmin()) {
            return true;
        }

        // Vérifier le niveau de confidentialité
        $rangCourrier = $courrier->niveauConfidentialite?->rang ?? 0;
        $rangUser = $user->getRangNiveauConfidentialite();

        if ($rangCourrier > $rangUser) {
            return false;
        }

        // Pour le chef, vérifier qu'il est dans le même service que le créateur
        if ($user->estChef()) {
            if (!$courrier->createur || $courrier->createur->service_id !== $user->service_id) {
                return false;
            }
        }

        // Pour le secretaire, vérifier qu'il a créé le courrier
        if ($user->estSecretaire()) {
            return $courrier->createur_id === $user->id;
        }

        return false;
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

        // Vérifier les droits de création
        if (!$user->peutCreerCourrier()) {
            return response()->json([
                'error' => 'Vous n\'avez pas le droit de créer des courriers.'
            ], 403);
        }

        $donnees = $request->validated();

        // Générer le numéro de courrier
        $annee = date('Y');
        $caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        $random = '';
        for ($i = 0; $i < 8; $i++) {
            $random .= $caracteres[rand(0, strlen($caracteres) - 1)];
        }
        $donnees['numero'] = 'COUR-' . $annee . '-' . $random;

        // Gérer le fichier uploadé
        if ($request->hasFile('fichier')) {
            $fichier = $request->file('fichier');
            $nomFichier = time() . '_' . $fichier->getClientOriginalName();
            $chemin = $fichier->storeAs('courriers', $nomFichier, 'public');
            $donnees['chemin_fichier'] = $chemin;
        }

        // Définir les valeurs par défaut
        $donnees['statut'] = Courrier::STATUT_CREE;
        $donnees['date_creation'] = now();
        $donnees['createur_id'] = $user->id;

        $courrier = Courrier::create($donnees);
        $courrier->load(['niveauConfidentialite', 'createur']);

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

        // Vérifier si l'utilisateur peut voir les détails
        if (!$this->userPeutVoirDetails($user, $courrier)) {
            return response()->json([
                'error' => 'Vous n\'avez pas le droit de voir ce courrier.'
            ], 403);
        }

        $courrier->load(['niveauConfidentialite', 'createur', 'valideur']);

        return response()->json([
            'courrier' => $courrier,
        ]);
    }

    /**
     * Retourne les données nécessaires pour le formulaire d'édition.
     */
    public function edit(Courrier $courrier, Request $request): JsonResponse
    {
        $user = $request->user();

        // Vérifier les droits de modification
        if ($courrier->createur_id !== $user->id && !$user->estAdmin()) {
            return response()->json([
                'error' => 'Vous n\'avez pas le droit de modifier ce courrier.'
            ], 403);
        }

        // Récupérer les niveaux de confidentialité accessibles
        $niveaux = NiveauConfidentialite::where('rang', '<=', $user->getRangNiveauConfidentialite())
            ->orderBy('rang')
            ->get();

        $types = [
            ['value' => 'entrant', 'label' => 'Entrant'],
            ['value' => 'sortant', 'label' => 'Sortant'],
        ];

        $courrier->load(['niveauConfidentialite', 'createur']);

        return response()->json([
            'courrier' => $courrier,
            'niveaux_confidentialite' => $niveaux,
            'types' => $types,
        ]);
    }

    /**
     * Met à jour un courrier existant.
     */
    public function update(UpdateCourrierRequest $request, Courrier $courrier): JsonResponse
    {
        $user = $request->user();

        // Vérifier les droits de modification
        if ($courrier->createur_id !== $user->id && !$user->estAdmin()) {
            return response()->json([
                'error' => 'Vous n\'avez pas le droit de modifier ce courrier.'
            ], 403);
        }

        $donnees = $request->validated();

        // Gérer le nouveau fichier uploadé
        if ($request->hasFile('fichier')) {
            // Supprimer l'ancien fichier s'il existe
            if ($courrier->chemin_fichier) {
                Storage::disk('public')->delete($courrier->chemin_fichier);
            }

            $fichier = $request->file('fichier');
            $nomFichier = time() . '_' . $fichier->getClientOriginalName();
            $chemin = $fichier->storeAs('courriers', $nomFichier, 'public');
            $donnees['chemin_fichier'] = $chemin;
        }

        $courrier->update($donnees);
        $courrier->load(['niveauConfidentialite', 'createur', 'valideur']);

        return response()->json([
            'message' => 'Courrier mis à jour avec succès.',
            'courrier' => $courrier,
        ]);
    }

    /**
     * Supprime un courrier.
     */
    public function destroy(Courrier $courrier, Request $request): JsonResponse
    {
        $user = $request->user();

        // Vérifier les droits de suppression (seul le créateur ou l'admin)
        if ($courrier->createur_id !== $user->id && !$user->estAdmin()) {
            return response()->json([
                'error' => 'Vous n\'avez pas le droit de supprimer ce courrier.'
            ], 403);
        }

        // Supprimer le fichier associé s'il existe
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

        // Vérifier les droits d'archivage
        if (!$courrier->peutEtreArchivéPar($user)) {
            return response()->json([
                'error' => 'Vous n\'avez pas le droit d\'archiver ce courrier.'
            ], 403);
        }

        $courrier->update(['statut' => Courrier::STATUT_ARCHIVE]);
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

        // Vérifier les droits de validation
        if (!$courrier->peutEtreValidéPar($user)) {
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
