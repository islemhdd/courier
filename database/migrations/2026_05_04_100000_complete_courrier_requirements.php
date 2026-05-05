<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('courriers', function (Blueprint $table) {
            if (!Schema::hasColumn('courriers', 'sequence_number')) {
                $table->unsignedBigInteger('sequence_number')->nullable()->after('id');
            }
            if (!Schema::hasColumn('courriers', 'resume')) {
                $table->text('resume')->nullable()->after('objet');
            }
            if (!Schema::hasColumn('courriers', 'requiert_reponse')) {
                $table->boolean('requiert_reponse')->default(false)->after('parent_courrier_id');
            }
            if (!Schema::hasColumn('courriers', 'delai_reponse_jours')) {
                $table->unsignedInteger('delai_reponse_jours')->nullable()->after('requiert_reponse');
            }
            if (!Schema::hasColumn('courriers', 'date_limite_reponse')) {
                $table->dateTime('date_limite_reponse')->nullable()->after('delai_reponse_jours');
            }
            if (!Schema::hasColumn('courriers', 'repondu_le')) {
                $table->dateTime('repondu_le')->nullable()->after('date_limite_reponse');
            }
            if (!Schema::hasColumn('courriers', 'transmission_demandee')) {
                $table->boolean('transmission_demandee')->default(false)->after('statut');
            }
        });

        $counter = (int) DB::table('courriers')->max('sequence_number');
        DB::table('courriers')
            ->whereNull('sequence_number')
            ->orderBy('id')
            ->select(['id'])
            ->chunkById(100, function ($courriers) use (&$counter) {
                foreach ($courriers as $courrier) {
                    $counter++;
                    DB::table('courriers')
                        ->where('id', $courrier->id)
                        ->update([
                            'sequence_number' => $counter,
                            'numero' => sprintf('COUR-%06d', $counter),
                        ]);
                }
            });

        DB::table('courriers')
            ->where('requiert_reponse', true)
            ->whereNotNull('delai_reponse_jours')
            ->whereNull('date_limite_reponse')
            ->orderBy('id')
            ->select(['id', 'date_reception', 'delai_reponse_jours'])
            ->chunkById(100, function ($courriers) {
                foreach ($courriers as $courrier) {
                    DB::table('courriers')
                        ->where('id', $courrier->id)
                        ->update([
                            'date_limite_reponse' => \Carbon\Carbon::parse($courrier->date_reception ?? now())
                                ->addDays((int) $courrier->delai_reponse_jours),
                        ]);
                }
            });

        try {
            Schema::table('courriers', function (Blueprint $table) {
                $table->unique('sequence_number', 'courriers_sequence_number_unique');
            });
        } catch (\Throwable $e) {
            // Index already exists or not supported by the current database driver.
        }

        if (DB::getDriverName() !== 'sqlite') {
            try {
                Schema::table('courriers', function (Blueprint $table) {
                    $table->fullText('resume', 'courriers_resume_fulltext');
                });
            } catch (\Throwable $e) {
                // Full-text index already exists or is not supported by the current driver.
            }
        }

        try {
            Schema::table('courrier_recipients', function (Blueprint $table) {
                $table->index(['recipient_type', 'structure_id'], 'courrier_recipients_structure_lookup');
                $table->index(['recipient_type', 'service_id'], 'courrier_recipients_service_lookup');
                $table->index(['recipient_type', 'user_id'], 'courrier_recipients_user_lookup');
            });
        } catch (\Throwable $e) {
            // Lookup indexes already exist.
        }
    }

    public function down(): void
    {
        try {
            Schema::table('courrier_recipients', function (Blueprint $table) {
                $table->dropIndex('courrier_recipients_structure_lookup');
                $table->dropIndex('courrier_recipients_service_lookup');
                $table->dropIndex('courrier_recipients_user_lookup');
            });
        } catch (\Throwable $e) {
        }

        try {
            Schema::table('courriers', function (Blueprint $table) {
                $table->dropUnique('courriers_sequence_number_unique');
            });
        } catch (\Throwable $e) {
        }

        if (DB::getDriverName() !== 'sqlite') {
            try {
                Schema::table('courriers', function (Blueprint $table) {
                    $table->dropFullText('courriers_resume_fulltext');
                });
            } catch (\Throwable $e) {
            }
        }
    }
};
