<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreMessageRequest;
use App\Http\Requests\UpdateMessageRequest;
use App\Models\Courrier;
use App\Models\Message;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MessageController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $type = $request->get('type', 'recu');
        $search = trim((string) $request->get('q', ''));
        $lu = $request->get('lu');
        $courrierId = $request->get('courrier_id');

        $query = Message::with(['emetteur', 'destinataire', 'courrier']);

        if ($type === 'envoye') {
            $query->where('emetteur_id', $user->id);
        } else {
            $query->where('destinataire_id', $user->id);
        }

        if ($search !== '') {
            $query->where(function ($subQuery) use ($search) {
                $subQuery->where('contenu', 'like', '%' . $search . '%')
                    ->orWhereHas('emetteur', function ($userQuery) use ($search) {
                        $userQuery->where('nom', 'like', '%' . $search . '%')
                            ->orWhere('prenom', 'like', '%' . $search . '%')
                            ->orWhere('email', 'like', '%' . $search . '%');
                    })
                    ->orWhereHas('destinataire', function ($userQuery) use ($search) {
                        $userQuery->where('nom', 'like', '%' . $search . '%')
                            ->orWhere('prenom', 'like', '%' . $search . '%')
                            ->orWhere('email', 'like', '%' . $search . '%');
                    });
            });
        }

        if ($lu !== null && $lu !== '') {
            $query->where('lu', filter_var($lu, FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE) ?? false);
        }

        if ($courrierId) {
            $query->where('courrier_id', $courrierId);
        }

        $messages = $query->orderBy('date_envoi', 'desc')->paginate(15);

        $messages->getCollection()->transform(function (Message $message) {
            $message->courrier_accessible = $message->destinatairePeutVoirCourrier();
            return $message;
        });

        return response()->json([
            'messages' => $messages,
            'type' => $type,
            'filtres' => [
                'q' => $search,
                'lu' => $lu,
                'courrier_id' => $courrierId,
            ],
        ]);
    }

    public function store(StoreMessageRequest $request): JsonResponse
    {
        $user = $request->user();
        $donnees = $request->validated();

        if ($donnees['destinataire_id'] === $user->id) {
            return response()->json([
                'error' => 'Vous ne pouvez pas vous envoyer un message à vous-même.'
            ], 422);
        }

        if (!empty($donnees['courrier_id'])) {
            $courrier = Courrier::with('niveauConfidentialite', 'createur')->find($donnees['courrier_id']);

            if (!$courrier) {
                return response()->json([
                    'error' => 'Le courrier référencé n\'existe pas.'
                ], 422);
            }

            if (!$this->userPeutVoirCourrier($user, $courrier)) {
                return response()->json([
                    'error' => 'Vous n\'avez pas le droit de référencer ce courrier.'
                ], 422);
            }
        }

        $donnees['emetteur_id'] = $user->id;
        $donnees['date_envoi'] = now();
        $donnees['lu'] = false;

        $message = Message::create($donnees);
        $message->load(['emetteur', 'destinataire', 'courrier']);
        $message->courrier_accessible = $message->destinatairePeutVoirCourrier();

        return response()->json([
            'message' => 'Message envoyé avec succès.',
            'data' => $message,
        ], 201);
    }

    public function show(Message $message, Request $request): JsonResponse
    {
        $user = $request->user();

        if ($message->emetteur_id !== $user->id && $message->destinataire_id !== $user->id) {
            return response()->json([
                'error' => 'Vous n\'avez pas le droit de voir ce message.'
            ], 403);
        }

        $message->load(['emetteur', 'destinataire', 'courrier']);

        if ($message->destinataire_id === $user->id && !$message->lu) {
            $message->marquerCommeLu();
            $message->refresh();
        }

        $message->courrier_accessible = $message->destinatairePeutVoirCourrier();

        return response()->json([
            'message' => $message,
        ]);
    }

    public function update(UpdateMessageRequest $request, Message $message): JsonResponse
    {
        if ($message->lu) {
            return response()->json([
                'error' => 'Impossible de modifier un message déjà lu.'
            ], 422);
        }

        $message->update($request->validated());
        $message->load(['emetteur', 'destinataire', 'courrier']);
        $message->courrier_accessible = $message->destinatairePeutVoirCourrier();

        return response()->json([
            'message' => 'Message modifié avec succès.',
            'data' => $message,
        ]);
    }

    public function destroy(Message $message, Request $request): JsonResponse
    {
        $user = $request->user();

        if ($message->emetteur_id !== $user->id && $message->destinataire_id !== $user->id) {
            return response()->json([
                'error' => 'Vous n\'avez pas le droit de supprimer ce message.'
            ], 403);
        }

        $message->delete();

        return response()->json([
            'message' => 'Message supprimé avec succès.',
        ]);
    }

    public function markRead(Message $message, Request $request): JsonResponse
    {
        $user = $request->user();

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

    public function rechercherDestinataires(Request $request): JsonResponse
    {
        $user = $request->user();
        $terme = trim((string) $request->get('q', ''));

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

    private function userPeutVoirCourrier(User $user, Courrier $courrier): bool
    {
        return $courrier->peutEtreVuEnDetailPar($user);
    }
}
