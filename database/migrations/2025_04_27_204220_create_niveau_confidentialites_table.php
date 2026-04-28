<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('niveau_confidentialites', function (Blueprint $table) {
            $table->id();
            $table->string('libelle', 50);    // Exemples : "Public", "Confidentiel", "Secret"
            $table->unsignedTinyInteger('rang');      // Exemples : 0 (public), 1 (confidentiel), 2 (secret)
            $table->timestamps();         // created_at, updated_at
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('niveau_confidentialites');
    }
};
