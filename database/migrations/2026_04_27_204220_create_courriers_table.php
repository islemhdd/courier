<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Migration
        Schema::create('courriers', function (Blueprint $table) {
            $table->id();                                  // BIGINT UNSIGNED (8 octets)
            $table->string('numero', 30)->unique();        // VARCHAR(30) ex: "COUR-2025-0001"
            $table->string('objet', 100);                  // VARCHAR(100)
            $table->string('type', 20);                    // VARCHAR(20) ex: lettre, fax, email
            $table->string('chemin_fichier', 255)->nullable();
            $table->dateTime('date_creation');
            $table->dateTime('date_reception');
            $table->string('expediteur', 100);             // VARCHAR(100)
            $table->enum('statut', ['CREE', 'VALIDE', 'TRANSMIS', 'RECU'])->default('CREE');

            // FK

            $table->foreignId('niveau_confidentialite_id')->references('id')->on('niveau_confidentialites');
            $table->foreignId('createur_id')->nullable()->constrained('users')->onDelete('set null');
            $table->foreignId('valideur_id')->nullable()->constrained('users')->onDelete('set null');

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('courriers');
    }
};
