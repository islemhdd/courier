<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Supprimer 'name' par défaut si présent, et ajouter nos colonnes
            if (Schema::hasColumn('users', 'name')) {
                $table->dropColumn('name');
            }

            $table->string('nom')->after('id');
            $table->string('prenom')->after('nom');
            $table->boolean('actif')->default(true)->after('password');
            $table->enum('role', ['admin', 'chef', 'secretaire'])->default('secretaire')->after('actif');

            // Clés étrangères (nullable d'abord pour éviter les erreurs)
            // $table->foreignId('service_id')->nullable()->after('role');
            $table->foreignId('niveau_confidentialite_id')->nullable()->after('service_id');

            // Contraintes (ajoutées après coup si les tables existent)
            $table->foreign('service_id')->references('id')->on('services')->onDelete('set null');
            $table->foreign('niveau_confidentialite_id')->references('id')->on('niveau_confidentialites')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['service_id']);
            $table->dropForeign(['niveau_confidentialite_id']);
            $table->dropColumn(['nom', 'prenom', 'actif', 'role', 'service_id', 'niveau_confidentialite_id']);

            // Remettre 'name' par défaut si souhaité
            $table->string('name')->after('id');
        });
    }
};
