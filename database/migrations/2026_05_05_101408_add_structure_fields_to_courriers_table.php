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
        Schema::table('courriers', function (Blueprint $table) {
            $table->foreignId('structure_origine_id')->nullable()->constrained('structures')->onDelete('set null')->after('service_source_id');
            $table->foreignId('structure_destinataire_id')->nullable()->constrained('structures')->onDelete('set null')->after('service_destinataire_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('courriers', function (Blueprint $table) {
            $table->dropForeign(['structure_origine_id']);
            $table->dropForeign(['structure_destinataire_id']);
            $table->dropColumn(['structure_origine_id', 'structure_destinataire_id']);
        });
    }
};
