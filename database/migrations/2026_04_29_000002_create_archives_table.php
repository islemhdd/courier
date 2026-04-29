<?php

use App\Models\Courrier;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('archives', function (Blueprint $table) {
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
            $table->foreignId('niveau_confidentialite_id')->nullable()->constrained('niveau_confidentialites')->onDelete('set null');
            $table->foreignId('createur_id')->nullable()->constrained('users')->onDelete('set null');
            $table->foreignId('valideur_id')->nullable()->constrained('users')->onDelete('set null');
            $table->foreignId('service_source_id')->nullable()->constrained('services')->onDelete('set null');
            $table->foreignId('service_destinataire_id')->nullable()->constrained('services')->onDelete('set null');
            $table->foreignId('transmis_par_id')->nullable()->constrained('users')->onDelete('set null');
            $table->dateTime('transmis_le')->nullable();
            $table->foreignId('archive_par_id')->nullable()->constrained('users')->onDelete('set null');
            $table->dateTime('archive_le');
            $table->string('motif', 120)->nullable();
            $table->timestamps();

            $table->index('courrier_original_id');
            $table->index('numero');
            $table->index('statut_original');
        });

        if (Schema::hasColumn('courriers', 'statut')) {
            Courrier::where('statut', 'ARCHIVE')
                ->with(['createur'])
                ->chunkById(100, function ($courriers) {
                    foreach ($courriers as $courrier) {
                        DB::table('archives')->insert([
                            'courrier_original_id' => $courrier->id,
                            'numero' => $courrier->numero,
                            'objet' => $courrier->objet,
                            'type' => $courrier->type,
                            'chemin_fichier' => $courrier->chemin_fichier,
                            'date_creation' => $courrier->date_creation,
                            'date_reception' => $courrier->date_reception,
                            'expediteur' => $courrier->expediteur,
                            'destinataire' => $courrier->destinataire,
                            'statut_original' => 'TRANSMIS',
                            'niveau_confidentialite_id' => $courrier->niveau_confidentialite_id,
                            'createur_id' => $courrier->createur_id,
                            'valideur_id' => $courrier->valideur_id,
                            'service_source_id' => $courrier->service_source_id ?? $courrier->createur?->service_id,
                            'service_destinataire_id' => $courrier->service_destinataire_id ?? null,
                            'transmis_par_id' => $courrier->transmis_par_id ?? null,
                            'transmis_le' => $courrier->transmis_le ?? null,
                            'archive_par_id' => null,
                            'archive_le' => now(),
                            'motif' => 'Migration depuis ancien statut ARCHIVE',
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);

                        DB::table('courriers')->where('id', $courrier->id)->delete();
                    }
                });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('archives');
    }
};
