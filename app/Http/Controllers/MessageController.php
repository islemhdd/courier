<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreMessageRequest;
use App\Http\Requests\UpdateMessageRequest;
use App\Models\Courrier;
use App\Models\Message;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class MessageController extends Controller
{
    private static ?bool $messagesHasStatutColumn = null;

    private function messagesHasStatut(): bool
    {
        if (self::$messagesHasStatutColumn === null) {
            self::$messagesHasStatutColumn = Schema::hasColumn('messages', 'statut');
        }

        return self::$messagesHasStatutColumn;
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $type = $request->get('type', 'recu');
        $search = trim((string) $request->get('q', ''));
        $lu = $request->get('lu');
        $courrierId = $request->get('courrier_id');

        $query = Message::with(['emetteur', 'destinataire', 'courrier']);
        $hasStatut = $this->messagesHasStatut();

        if ($type === 'brouillon') {
            $query
                ->where('emetteur_id', $user->id)
                ->when($hasStatut, fn ($q) => $q->where('statut', Message::STATUT_CREE))
                ->when(!$hasStatut, fn ($q) => $q->whereRaw('0 = 1'));
        } elseif ($type === 'envoye') {
            $query->where('emetteur_id', $user->id);
            if ($hasStatut) {
                $query->where('statut', Message::STATUT_ENVOYE);
            }
        } else {
            // Inbox shows only sent messages when statut is available (otherwise keep legacy behavior).
            $query->where('destinataire_id', $user->id);
            if ($hasStatut) {
                $query->where('statut', Message::STATUT_ENVOYE);
            }
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
        $envoyer = array_key_exists('envoyer', $donnees) ? (bool) $donnees['envoyer'] : true;
        $hasStatut = $this->messagesHasStatut();

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
        $donnees['lu'] = false;
        if ($hasStatut) {
            $donnees['statut'] = $envoyer ? Message::STATUT_ENVOYE : Message::STATUT_CREE;
        }
        // date_envoi is used for ordering/display; for drafts it's "created at", for sent it's "sent at".
        $donnees['date_envoi'] = now();

        $message = Message::create($donnees);
        $message->load(['emetteur', 'destinataire', 'courrier']);
        $message->courrier_accessible = $message->destinatairePeutVoirCourrier();

        return response()->json([
            'message' => $envoyer ? 'Message envoyé avec succès.' : 'Brouillon enregistré avec succès.',
            'data' => $message,
        ], 201);
    }

    public function show(Message $message, Request $request): JsonResponse
    {
        $user = $request->user();
        $hasStatut = $this->messagesHasStatut();

        if ($message->emetteur_id !== $user->id && $message->destinataire_id !== $user->id) {
            return response()->json([
                'error' => 'Vous n\'avez pas le droit de voir ce message.'
            ], 403);
        }

        // Drafts are visible only to the sender.
        if ($hasStatut && $message->statut === Message::STATUT_CREE && $message->emetteur_id !== $user->id) {
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
        $user = $request->user();
        $hasStatut = $this->messagesHasStatut();

        if ($message->emetteur_id !== $user->id) {
            return response()->json([
                'error' => 'Vous n\'avez pas le droit de modifier ce message.'
            ], 403);
        }

        if ($hasStatut && $message->statut === Message::STATUT_ENVOYE) {
            return response()->json([
                'error' => 'Impossible de modifier un message déjà envoyé.'
            ], 422);
        }

        if (!$hasStatut && $message->lu) {
            return response()->json([
                'error' => 'Impossible de modifier un message déjà lu.'
            ], 422);
        }

        $payload = $request->validated();

        if (array_key_exists('destinataire_id', $payload) && $payload['destinataire_id'] === $user->id) {
            return response()->json([
                'error' => 'Vous ne pouvez pas vous envoyer un message à vous-même.'
            ], 422);
        }

        $message->update($payload);
        $message->load(['emetteur', 'destinataire', 'courrier']);
        $message->courrier_accessible = $message->destinatairePeutVoirCourrier();

        return response()->json([
            'message' => 'Brouillon modifié avec succès.',
            'data' => $message,
        ]);
    }

    public function destroy(Message $message, Request $request): JsonResponse
    {
        $user = $request->user();
        $hasStatut = $this->messagesHasStatut();

        if (!$hasStatut && $message->emetteur_id !== $user->id && $message->destinataire_id !== $user->id) {
            return response()->json([
                'error' => 'Vous n\'avez pas le droit de supprimer ce message.'
            ], 403);
        }

        if ($hasStatut && $message->emetteur_id !== $user->id) {
            return response()->json([
                'error' => 'Vous n\'avez pas le droit de supprimer ce message.'
            ], 403);
        }

        if ($hasStatut && $message->statut === Message::STATUT_ENVOYE) {
            return response()->json([
                'error' => 'Impossible de supprimer un message déjà envoyé.'
            ], 422);
        }

        $message->delete();

        return response()->json([
            'message' => 'Brouillon supprimé avec succès.',
        ]);
    }

    public function sendDraft(Message $message, Request $request): JsonResponse
    {
        $user = $request->user();
        $hasStatut = $this->messagesHasStatut();

        if (!$hasStatut) {
            return response()->json([
                'error' => 'La fonctionnalité de brouillons nécessite une migration de base de données (colonne messages.statut).'
            ], 422);
        }

        if ($message->emetteur_id !== $user->id) {
            return response()->json([
                'error' => 'Vous n\'avez pas le droit de modifier ce message.'
            ], 403);
        }

        if ($message->statut !== Message::STATUT_CREE) {
            return response()->json([
                'error' => 'Seuls les brouillons peuvent être envoyés.'
            ], 422);
        }

        if ($message->destinataire_id === $user->id) {
            return response()->json([
                'error' => 'Vous ne pouvez pas vous envoyer un message à vous-même.'
            ], 422);
        }

        $message->update([
            'statut' => Message::STATUT_ENVOYE,
            'date_envoi' => now(),
            'lu' => false,
        ]);

        $message->load(['emetteur', 'destinataire', 'courrier']);
        $message->courrier_accessible = $message->destinatairePeutVoirCourrier();

        return response()->json([
            'message' => 'Message envoyé avec succès.',
            'data' => $message,
        ]);
    }

    public function markRead(Message $message, Request $request): JsonResponse
    {
        $user = $request->user();
        $hasStatut = $this->messagesHasStatut();

        if ($message->destinataire_id !== $user->id) {
            return response()->json([
                'error' => 'Vous n\'avez pas le droit de modifier ce message.'
            ], 403);
        }

        if ($hasStatut && $message->statut !== Message::STATUT_ENVOYE) {
            return response()->json([
                'error' => 'Impossible de marquer comme lu un brouillon.'
            ], 422);
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

        // Provide a default suggestion list when the field is empty, so the UI
        // can show recipients without forcing the user to type.
        if ($terme === '') {
            $query = User::where('id', '!=', $user->id)
                ->where('actif', true)
                ->select('id', 'nom', 'prenom', 'email');

            if ($user->service_id !== null) {
                // Prioritize same-service users first, then sort by name/email.
                $query->orderByRaw('CASE WHEN service_id = ? THEN 0 ELSE 1 END', [$user->service_id]);
            }

            $utilisateurs = $query
                ->orderBy('prenom')
                ->orderBy('nom')
                ->orderBy('email')
                ->limit(10)
                ->get();

            return response()->json([
                'utilisateurs' => $utilisateurs,
            ]);
        }

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
        $hasStatut = $this->messagesHasStatut();

        $nombre = Message::where('destinataire_id', $user->id)
            ->when($hasStatut, fn ($q) => $q->where('statut', Message::STATUT_ENVOYE))
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
