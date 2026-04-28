<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthenticatedSessionController;
use App\Http\Controllers\CourrierController;
use App\Http\Controllers\MessageController;

Route::post('/login', [AuthenticatedSessionController::class, 'store']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', [AuthenticatedSessionController::class, 'me']);
    Route::post('/logout', [AuthenticatedSessionController::class, 'destroy']);
     Route::post('/courriers/{courrier}', [CourrierController::class, 'update']);
    Route::get('/courriers', [CourrierController::class, 'index']);
    Route::get('/courriers/recus', [CourrierController::class, 'recus']);
    Route::get('/courriers/envoyes', [CourrierController::class, 'envoyes']);
    Route::get('/courriers/create', [CourrierController::class, 'create']);
    Route::post('/courriers', [CourrierController::class, 'store']);
    Route::get('/courriers/{courrier}', [CourrierController::class, 'show']);
    Route::post('/courriers/{courrier}', [CourrierController::class, 'update']);
    Route::delete('/courriers/{courrier}', [CourrierController::class, 'destroy']);

    Route::patch('/courriers/{courrier}/archiver', [CourrierController::class, 'archiver']);
    Route::patch('/courriers/{courrier}/valider', [CourrierController::class, 'valider']);

    Route::get('/messages', [MessageController::class, 'index']);
    Route::post('/messages', [MessageController::class, 'store']);
    Route::get('/messages/non-lus', [MessageController::class, 'nombreNonLus']);
    Route::get('/messages/destinataires', [MessageController::class, 'rechercherDestinataires']);
    Route::get('/messages/{message}', [MessageController::class, 'show']);
    Route::patch('/messages/{message}/read', [MessageController::class, 'markRead']);
});