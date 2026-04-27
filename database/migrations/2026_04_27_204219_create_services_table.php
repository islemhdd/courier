<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('services', function (Blueprint $table) {
            $table->id();                        // BIGINT UNSIGNED (8 octets)
            $table->string('libelle', 50);       // VARCHAR(50)
            $table->timestamps();                // created_at, updated_at
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('services');
    }
};
