<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'mysql') {
            DB::statement("
                ALTER TABLE archives
                MODIFY statut_original ENUM('VALIDE', 'TRANSMIS', 'RECU')
            ");
            return;
        }

        if ($driver === 'sqlite') {
            Schema::create('archives_temp', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('courrier_original_id')->nullable();
                $table->string('numero', 30);
                $table->string('objet', 100);
                $table->string('type', 20);
                $table->string('chemin_fichier', 255)->nullable();
                $table->dateTime('date_creation');
                $table->dateTime('date_reception');
                $table->string('expediteur', 100);
                $table->string('destinataire', 100)->nullable();
                $table->enum('statut_original', ['VALIDE', 'TRANSMIS', 'RECU']);
                $table->foreignId('niveau_confidentialite_id')->nullable()->constrained('niveau_confidentialites')->nullOnDelete();
                $table->foreignId('createur_id')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('valideur_id')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('service_source_id')->nullable()->constrained('services')->nullOnDelete();
                $table->foreignId('service_destinataire_id')->nullable()->constrained('services')->nullOnDelete();
                $table->foreignId('transmis_par_id')->nullable()->constrained('users')->nullOnDelete();
                $table->dateTime('transmis_le')->nullable();
                $table->foreignId('archive_par_id')->nullable()->constrained('users')->nullOnDelete();
                $table->dateTime('archive_le');
                $table->string('motif', 120)->nullable();
                $table->timestamps();

                $table->index('courrier_original_id');
                $table->index('numero');
                $table->index('statut_original');
            });

            DB::table('archives')
                ->orderBy('id')
                ->get()
                ->each(function ($archive) {
                    DB::table('archives_temp')->insert((array) $archive);
                });

            Schema::drop('archives');
            Schema::rename('archives_temp', 'archives');
        }
    }

    public function down(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'mysql') {
            DB::statement("
                UPDATE archives
                SET statut_original = 'TRANSMIS'
                WHERE statut_original = 'VALIDE'
            ");

            DB::statement("
                ALTER TABLE archives
                MODIFY statut_original ENUM('TRANSMIS', 'RECU')
            ");
            return;
        }

        if ($driver === 'sqlite') {
            DB::table('archives')
                ->where('statut_original', 'VALIDE')
                ->update(['statut_original' => 'TRANSMIS']);

            Schema::create('archives_temp', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('courrier_original_id')->nullable();
                $table->string('numero', 30);
                $table->string('objet', 100);
                $table->string('type', 20);
                $table->string('chemin_fichier', 255)->nullable();
                $table->dateTime('date_creation');
                $table->dateTime('date_reception');
                $table->string('expediteur', 100);
                $table->string('destinataire', 100)->nullable();
                $table->enum('statut_original', ['TRANSMIS', 'RECU']);
                $table->foreignId('niveau_confidentialite_id')->nullable()->constrained('niveau_confidentialites')->nullOnDelete();
                $table->foreignId('createur_id')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('valideur_id')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('service_source_id')->nullable()->constrained('services')->nullOnDelete();
                $table->foreignId('service_destinataire_id')->nullable()->constrained('services')->nullOnDelete();
                $table->foreignId('transmis_par_id')->nullable()->constrained('users')->nullOnDelete();
                $table->dateTime('transmis_le')->nullable();
                $table->foreignId('archive_par_id')->nullable()->constrained('users')->nullOnDelete();
                $table->dateTime('archive_le');
                $table->string('motif', 120)->nullable();
                $table->timestamps();

                $table->index('courrier_original_id');
                $table->index('numero');
                $table->index('statut_original');
            });

            DB::table('archives')
                ->orderBy('id')
                ->get()
                ->each(function ($archive) {
                    DB::table('archives_temp')->insert((array) $archive);
                });

            Schema::drop('archives');
            Schema::rename('archives_temp', 'archives');
        }
    }
};
