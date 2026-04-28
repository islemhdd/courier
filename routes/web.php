<?php

use App\Http\Controllers\CourrierController;
use App\Http\Controllers\MessageController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('welcome');
})->name('home');

Route::middleware(['auth'])->group(function () {
    Route::get('dashboard', function () {
        return Inertia::render('dashboard');
    })->name('dashboard');

    // Routes pour les courriers
    Route::get('/courriers', [CourrierController::class, 'index'])->name('courriers.index');
    Route::get('/courriers/create', [CourrierController::class, 'create'])->name('courriers.create');
    Route::post('/courriers', [CourrierController::class, 'store'])->name('courriers.store');
    Route::get('/courriers/{courrier}', [CourrierController::class, 'show'])->name('courriers.show');
    Route::get('/courriers/{courrier}/edit', [CourrierController::class, 'edit'])->name('courriers.edit');
    Route::put('/courriers/{courrier}', [CourrierController::class, 'update'])->name('courriers.update');
    Route::delete('/courriers/{courrier}', [CourrierController::class, 'destroy'])->name('courriers.destroy');

    // Routes supplémentaires pour les courriers
    Route::patch('/courriers/{courrier}/archiver', [CourrierController::class, 'archiver'])->name('courriers.archiver');
    Route::patch('/courriers/{courrier}/valider', [CourrierController::class, 'valider'])->name('courriers.valider');

    // Routes pour les messages
    Route::get('/messages', [MessageController::class, 'index'])->name('messages.index');
    Route::post('/messages', [MessageController::class, 'store'])->name('messages.store');
    Route::get('/messages/{message}', [MessageController::class, 'show'])->name('messages.show');
    Route::patch('/messages/{message}/mark-read', [MessageController::class, 'markRead'])->name('messages.markRead');

    // Route pour rechercher des destinataires (autocomplétion)
    Route::get('/messages/destinataires', [MessageController::class, 'rechercherDestinataires'])->name('messages.destinataires');

    // Route pour le nombre de messages non lus
    Route::get('/messages/non-lus/count', [MessageController::class, 'nombreNonLus'])->name('messages.nonLus');
});

require __DIR__ . '/settings.php';
require __DIR__ . '/auth.php';
