<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreMessageRequest;
use App\Models\Courrier;
use App\Models\Message;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Contrôleur pour la gestion des messages.
 * Toutes les réponses sont au format JSON pour l'API.
 */
class MessageController extends Controller
{
    /**
     * Affiche la liste paginée des messages pour l'utilisateur connecté.
     * Peut filtrer par messages reçus ou envoyés.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $type = $request->get('type', 'recu'); // 'recu' ou 'envoye'

        $query = Message::with(['emetteur', 'destinataire', 'courrier']);

        if ($type === 'envoye') {
            $query->where('emetteur_id', $user->id);
        } else {
            $query->where('destinataire_id', $user->id);
        }

        $messages = $query->orderBy('date_envoi', 'desc')
            ->paginate(15);

        // Pour chaque message, vérifier si le destinataire peut voir le courrier
        $messages->getCollection()->transform(function ($message) {
            $message->courrier_accessible = $message->destinatairePeutVoirCourrier();
            return $message;
        });

        return response()->json([
            'messages' => $messages,
            'type' => $type,
        ]);
    }

    /**
     * Envoie un nouveau message.
     */
    public function store(StoreMessageRequest $request): JsonResponse
    {
        $user = $request->user();
        $donnees = $request->validated();

        // Vérifier que le destinataire n'est pas l'expéditeur lui-même
        if ($donnees['destinataire_id'] === $user->id) {
            return response()->json([
                'error' => 'Vous ne pouvez pas vous envoyer un message à vous-même.'
            ], 422);
        }

        // Vérifier si le courrier référencé existe et si l'utilisateur peut le voir
        if (!empty($donnees['courrier_id'])) {
            $courrier = Courrier::with('niveauConfidentialite', 'createur')->find($donnees['courrier_id']);

            if (!$courrier) {
                return response()->json([
                    'error' => 'Le courrier référencé n\'existe pas.'
                ], 422);
            }

            // Vérifier les droits de consultation du courrier
            if (!$this->userPeutVoirCourrier($user, $courrier)) {
                return response()->json([
                    'error' => 'Vous n\'avez pas le droit de référencer ce courrier.'
                ], 422);
            }
        }

        // Définir les valeurs par défaut
        $donnees['emetteur_id'] = $user->id;
        $donnees['date_envoi'] = now();
        $donnees['lu'] = false;

        $message = Message::create($donnees);
        $message->load(['emetteur', 'destinataire', 'courrier']);

        return response()->json([
            'message' => 'Message envoyé avec succès.',
            'data' => $message,
        ], 201);
    }

    /**
     * Affiche les détails d'un message.
     */
    public function show(Message $message, Request $request): JsonResponse
    {
        $user = $request->user();

        // Vérifier que l'utilisateur est soit l'émetteur soit le destinataire
        if ($message->emetteur_id !== $user->id && $message->destinataire_id !== $user->id) {
            return response()->json([
                'error' => 'Vous n\'avez pas le droit de voir ce message.'
            ], 403);
        }

        $message->load(['emetteur', 'destinataire', 'courrier']);

        // Si l'utilisateur est le destinataire et que le message n'est pas lu, le marquer comme lu
        if ($message->destinataire_id === $user->id && !$message->lu) {
            $message->marquerCommeLu();
            $message->refresh();
        }

        return response()->json([
            'message' => $message,
        ]);
    }

    /**
     * Marque un message comme lu.
     */
    public function markRead(Message $message, Request $request): JsonResponse
    {
        $user = $request->user();

        // Vérifier que l'utilisateur est le destinataire
        if ($message->destinataire_id !== $user->id) {
            return response()->json([
                'error' => 'Vous n\'avez pas le droit de modifier ce message.'
            ], 403);
        }

        $message->marquerCommeLu();

        return response()->json([
            'message' => 'Message marqué comme lu.',
            'data' => $message->fresh(['emetteur', 'destinataire', 'courrier']),
        ]);
    }

    /**
     * Recherche des utilisateurs par nom ou email pour l'autocomplétion.
     */
    public function rechercherDestinataires(Request $request): JsonResponse
    {
        $user = $request->user();
        $terme = $request->get('q', '');

        if (strlen($terme) < 2) {
            return response()->json([
                'utilisateurs' => [],
            ]);
        }

        $utilisateurs = User::where('id', '!=', $user->id)
            ->where('actif', true)
            ->where(function ($query) use ($terme) {
                $query->where('nom', 'like', '%' . $terme . '%')
                    ->orWhere('prenom', 'like', '%' . $terme . '%')
                    ->orWhere('email', 'like', '%' . $terme . '%');
            })
            ->select('id', 'nom', 'prenom', 'email')
            ->limit(10)
            ->get();

        return response()->json([
            'utilisateurs' => $utilisateurs,
        ]);
    }

    /**
     * Retourne le nombre de messages non lus pour l'utilisateur connecté.
     */
    public function nombreNonLus(Request $request): JsonResponse
    {
        $user = $request->user();

        $nombre = Message::where('destinataire_id', $user->id)
            ->where('lu', false)
            ->count();

        return response()->json([
            'non_lus' => $nombre,
        ]);
    }

    /**
     * Vérifie si l'utilisateur peut voir le courrier.
     * Utilise les mêmes règles que pour l'affichage du détail.
     */
    private function userPeutVoirCourrier(User $user, Courrier $courrier): bool
    {
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

        // Pour le secretaire, vérifier qu'il a créé le courrier ou que le niveau est accessible
        if ($user->estSecretaire()) {
            if ($courrier->createur_id !== $user->id) {
                return $rangCourrier <= $rangUser;
            }
        }

        return true;
    }
}
