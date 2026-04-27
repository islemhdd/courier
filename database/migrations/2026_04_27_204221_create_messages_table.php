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
        Schema::create('messages', function (Blueprint $table) {
            $table->id();                                  // BIGINT UNSIGNED (8 octets)
            $table->text('contenu');                       // TEXT
            $table->dateTime('date_envoi');
            $table->boolean('lu')->default(false);         // TINYINT(1)

            // FK
            $table->foreignId('emetteur_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('destinataire_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('courrier_id')->nullable()->constrained('courriers')->onDelete('set null');

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('messages');
    }
};
