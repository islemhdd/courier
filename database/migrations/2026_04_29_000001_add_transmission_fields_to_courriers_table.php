<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('courriers', function (Blueprint $table) {
            $table->boolean('transmission_demandee')->default(false)->after('statut');
            $table->foreignId('service_source_id')->nullable()->after('transmission_demandee')->constrained('services')->onDelete('set null');
            $table->foreignId('service_destinataire_id')->nullable()->after('service_source_id')->constrained('services')->onDelete('set null');
            $table->foreignId('transmis_par_id')->nullable()->after('valideur_id')->constrained('users')->onDelete('set null');
            $table->dateTime('transmis_le')->nullable()->after('transmis_par_id');
        });
    }

    public function down(): void
    {
        Schema::table('courriers', function (Blueprint $table) {
            $table->dropForeign(['service_source_id']);
            $table->dropForeign(['service_destinataire_id']);
            $table->dropForeign(['transmis_par_id']);
            $table->dropColumn([
                'transmission_demandee',
                'service_source_id',
                'service_destinataire_id',
                'transmis_par_id',
                'transmis_le',
            ]);
        });
    }
};
