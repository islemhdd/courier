<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthenticatedSessionController;
use App\Http\Controllers\CourrierController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\ServiceController;
use App\Http\Controllers\UserController;

Route::post('/login', [AuthenticatedSessionController::class, 'store']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', [AuthenticatedSessionController::class, 'me']);
    Route::post('/logout', [AuthenticatedSessionController::class, 'destroy']);
    Route::prefix('/courriers')->group(function () {
        Route::get('/', [CourrierController::class, 'index']);
        Route::get('/recus', [CourrierController::class, 'recus']);
        Route::get('/envoyes', [CourrierController::class, 'envoyes']);
        Route::get('/archives', [CourrierController::class, 'archives']);
        Route::get('/validation', [CourrierController::class, 'validation']);
        Route::get('/stats', [CourrierController::class, 'stats']);
        Route::get('/create', [CourrierController::class, 'create']);
        Route::post('/', [CourrierController::class, 'store']);
        Route::get('/{courrier}', [CourrierController::class, 'show']);
        Route::match(['post', 'patch'], '/{courrier}', [CourrierController::class, 'update']);
        Route::delete('/{courrier}', [CourrierController::class, 'destroy']);
        Route::patch('/{courrier}/archiver', [CourrierController::class, 'archiver']);
        Route::patch('/{courrier}/transmettre', [CourrierController::class, 'transmettre']);
        Route::patch('/{courrier}/valider', [CourrierController::class, 'valider']);
        Route::patch('/{courrier}/non-valider', [CourrierController::class, 'nonValider']);
    });

    Route::delete('/archives/{archive}', [CourrierController::class, 'destroyArchive']);

    Route::prefix('/messages')->group(function () {
        Route::get('/', [MessageController::class, 'index']);
        Route::post('/', [MessageController::class, 'store']);
        Route::get('/non-lus', [MessageController::class, 'nombreNonLus']);
        Route::get('/destinataires', [MessageController::class, 'rechercherDestinataires']);
        Route::get('/{message}', [MessageController::class, 'show']);
        Route::patch('/{message}', [MessageController::class, 'update']);
        Route::delete('/{message}', [MessageController::class, 'destroy']);
        Route::patch('/{message}/send', [MessageController::class, 'sendDraft']);
        Route::patch('/{message}/read', [MessageController::class, 'markRead']);
    });

    Route::prefix('/utilisateurs')->group(function () {
        Route::get('/', [UserController::class, 'index']);
        Route::post('/', [UserController::class, 'store']);
        Route::patch('/{user}', [UserController::class, 'update']);
        Route::delete('/{user}', [UserController::class, 'destroy']);
    });

    Route::prefix('/services')->group(function () {
        Route::get('/', [ServiceController::class, 'index']);
        Route::post('/', [ServiceController::class, 'store']);
        Route::patch('/{service}', [ServiceController::class, 'update']);
        Route::delete('/{service}', [ServiceController::class, 'destroy']);
    });
});
