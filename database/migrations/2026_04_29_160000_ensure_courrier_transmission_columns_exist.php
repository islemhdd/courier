<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('courriers', function (Blueprint $table) {
            if (!Schema::hasColumn('courriers', 'transmission_demandee')) {
                $table->boolean('transmission_demandee')->default(false)->after('statut');
            }

            if (!Schema::hasColumn('courriers', 'service_source_id')) {
                $table->foreignId('service_source_id')
                    ->nullable()
                    ->after('transmission_demandee')
                    ->constrained('services')
                    ->nullOnDelete();
            }

            if (!Schema::hasColumn('courriers', 'service_destinataire_id')) {
                $table->foreignId('service_destinataire_id')
                    ->nullable()
                    ->after('service_source_id')
                    ->constrained('services')
                    ->nullOnDelete();
            }

            if (!Schema::hasColumn('courriers', 'transmis_par_id')) {
                $table->foreignId('transmis_par_id')
                    ->nullable()
                    ->after('valideur_id')
                    ->constrained('users')
                    ->nullOnDelete();
            }

            if (!Schema::hasColumn('courriers', 'transmis_le')) {
                $table->dateTime('transmis_le')->nullable()->after('transmis_par_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('courriers', function (Blueprint $table) {
            if (Schema::hasColumn('courriers', 'service_destinataire_id')) {
                $table->dropForeign(['service_destinataire_id']);
            }

            if (Schema::hasColumn('courriers', 'service_source_id')) {
                $table->dropForeign(['service_source_id']);
            }

            if (Schema::hasColumn('courriers', 'transmis_par_id')) {
                $table->dropForeign(['transmis_par_id']);
            }

            $columns = array_values(array_filter([
                Schema::hasColumn('courriers', 'transmission_demandee') ? 'transmission_demandee' : null,
                Schema::hasColumn('courriers', 'service_source_id') ? 'service_source_id' : null,
                Schema::hasColumn('courriers', 'service_destinataire_id') ? 'service_destinataire_id' : null,
                Schema::hasColumn('courriers', 'transmis_par_id') ? 'transmis_par_id' : null,
                Schema::hasColumn('courriers', 'transmis_le') ? 'transmis_le' : null,
            ]));

            if ($columns !== []) {
                $table->dropColumn($columns);
            }
        });
    }
};
