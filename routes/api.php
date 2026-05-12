<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Broadcast;

Broadcast::routes(['middleware' => ['auth:sanctum']]);

use App\Http\Controllers\Admin\AdminChefAffectationController;
use App\Http\Controllers\Admin\AdminServiceController;
use App\Http\Controllers\Admin\AdminStructureController;
use App\Http\Controllers\Api\AuthenticatedSessionController;
use App\Http\Controllers\Api\OcrController;
use App\Http\Controllers\CourrierController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\ServiceController;
use App\Http\Controllers\UserController;

Route::post('/login', [AuthenticatedSessionController::class, 'store'])->middleware('throttle:5,1');

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', [AuthenticatedSessionController::class, 'me']);
    Route::post('/logout', [AuthenticatedSessionController::class, 'destroy']);
    Route::prefix('/courriers')->group(function () {
        Route::get('/', [CourrierController::class, 'index'])->middleware('throttle:60,1');
        Route::get('/recus', [CourrierController::class, 'recus'])->middleware('throttle:60,1');
        Route::get('/envoyes', [CourrierController::class, 'envoyes'])->middleware('throttle:60,1');
        Route::get('/archives', [CourrierController::class, 'archives'])->middleware('throttle:60,1');
        Route::get('/archives/{archive}', [CourrierController::class, 'showArchive'])->middleware('throttle:60,1');
        Route::get('/validation', [CourrierController::class, 'validation'])->middleware('throttle:60,1');
        Route::get('/stats', [CourrierController::class, 'stats']);
        Route::get('/create', [CourrierController::class, 'create']);
        Route::post('/', [CourrierController::class, 'store'])->middleware('throttle:30,1');
        Route::get('/{courrier}', [CourrierController::class, 'show']);
        Route::get('/{courrier}/download', [CourrierController::class, 'downloadCourrierFile']);
        Route::get('/{courrier}/attachments/{attachmentId}/download', [CourrierController::class, 'downloadAttachment']);
        Route::patch('/{courrier}', [CourrierController::class, 'update'])->middleware('throttle:30,1');
        Route::delete('/{courrier}', [CourrierController::class, 'destroy']);
        Route::patch('/{courrier}/archiver', [CourrierController::class, 'archiver']);
        Route::patch('/{courrier}/transmettre', [CourrierController::class, 'transmettre']);
        Route::patch('/{courrier}/valider', [CourrierController::class, 'valider'])->middleware('throttle:30,1');
        Route::patch('/{courrier}/non-valider', [CourrierController::class, 'nonValider'])->middleware('throttle:30,1');
        Route::patch('/{courrier}/demander-validation', [CourrierController::class, 'demanderValidation'])->middleware('throttle:10,1');
    });

    Route::get('/archives/{archive}', [CourrierController::class, 'showArchive'])->middleware('throttle:60,1');
    Route::delete('/archives/{archive}', [CourrierController::class, 'destroyArchive']);

    Route::prefix('/messages')->group(function () {
        Route::get('/', [MessageController::class, 'index'])->middleware('throttle:60,1');
        Route::post('/', [MessageController::class, 'store'])->middleware('throttle:10,1');
        Route::get('/non-lus', [MessageController::class, 'nombreNonLus']);
        Route::get('/destinataires', [MessageController::class, 'rechercherDestinataires'])->middleware('throttle:30,1');
        Route::get('/{message}', [MessageController::class, 'show']);
        Route::patch('/{message}', [MessageController::class, 'update'])->middleware('throttle:30,1');
        Route::delete('/{message}', [MessageController::class, 'destroy']);
        Route::patch('/{message}/send', [MessageController::class, 'sendDraft'])->middleware('throttle:10,1');
        Route::patch('/{message}/read', [MessageController::class, 'markRead'])->middleware('throttle:30,1');
    });

    Route::prefix('/utilisateurs')->group(function () {
        Route::get('/', [UserController::class, 'index'])->middleware('throttle:60,1');
        Route::post('/', [UserController::class, 'store'])->middleware('throttle:10,1');
        Route::patch('/{user}', [UserController::class, 'update'])->middleware('throttle:30,1');
        Route::delete('/{user}', [UserController::class, 'destroy'])->middleware('throttle:10,1');
    });

    Route::post('/ocr/preview', [OcrController::class, 'preview']);

    Route::prefix('/courriers')->group(function () {
        Route::get('/{courrier}/ocr', [OcrController::class, 'status']);
        Route::post('/{courrier}/ocr/rerun', [OcrController::class, 'rerun']);
    });

    Route::prefix('/services')->group(function () {
        Route::get('/', [ServiceController::class, 'index'])->middleware('throttle:60,1');
        Route::post('/', [ServiceController::class, 'store'])->middleware('throttle:10,1');
        Route::patch('/{service}', [ServiceController::class, 'update'])->middleware('throttle:30,1');
        Route::delete('/{service}', [ServiceController::class, 'destroy'])->middleware('throttle:10,1');
    });

    Route::prefix('/admin')->middleware('admin')->group(function () {
        Route::get('/structures', [AdminStructureController::class, 'index']);
        Route::post('/structures', [AdminStructureController::class, 'store']);
        Route::patch('/structures/{structure}', [AdminStructureController::class, 'update']);
        Route::delete('/structures/{structure}', [AdminStructureController::class, 'destroy']);

        Route::get('/services', [AdminServiceController::class, 'index']);
        Route::post('/services', [AdminServiceController::class, 'store']);
        Route::patch('/services/{service}', [AdminServiceController::class, 'update']);
        Route::delete('/services/{service}', [AdminServiceController::class, 'destroy']);

        Route::patch('/structures/{structure}/chef', [AdminChefAffectationController::class, 'assignStructureChef']);
        Route::patch('/services/{service}/chef', [AdminChefAffectationController::class, 'assignServiceChef']);
    });

    Route::prefix('/notifications')->group(function () {
        Route::get('/', function (Request $request) {
            return response()->json([
                'notifications' => $request->user()->notifications()->take(50)->get()->map(function ($notification) {
                    $data = $notification->data;

                    return [
                        'id' => $notification->id,
                        'type' => $data['type'] ?? '',
                        'titre' => $data['titre'] ?? 'Notification',
                        'message' => $data['message'] ?? '',
                        'data' => $data,
                        'read_at' => $notification->read_at,
                        'created_at' => $notification->created_at,
                        '_at' => $notification->created_at,
                        '_persisted' => true,
                    ];
                }),
                'non_lus' => $request->user()->unreadNotifications()->count(),
            ]);
        });

        Route::patch('/{notification}/read', function (Request $request, $notificationId) {
            $notification = $request->user()->notifications()->findOrFail($notificationId);
            $notification->markAsRead();

            return response()->json(['success' => true]);
        });

        Route::patch('/read-all', function (Request $request) {
            $request->user()->unreadNotifications()->update(['read_at' => now()]);

            return response()->json(['success' => true]);
        });

        Route::delete('/{notification}', function (Request $request, $notificationId) {
            $request->user()->notifications()->findOrFail($notificationId)->delete();

            return response()->json(['success' => true]);
        });

        Route::delete('/', function (Request $request) {
            $request->user()->notifications()->delete();

            return response()->json(['success' => true]);
        });
    });

    Route::post('/test-notification', function (Request $request) {
        $user = $request->user();

        $message = new \App\Models\Message();
        $message->id = 999;
        $message->contenu = 'Ceci est un test de notification';

        // Mock emetteur
        $message->setRelation('emetteur', $user);

        $user->notifyNow(new \App\Notifications\MessageSentNotification($message));

        return response()->json(['success' => true, 'message' => 'Notification envoyée !']);
    });
});
