<?php

namespace App\Console\Commands;

use App\Models\Archive;
use App\Models\Courrier;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ArchiveValidatedCourriers extends Command
{
    protected $signature = 'courriers:archiver-valides';

    protected $description = 'Archive automatiquement les courriers valides.';

    public function handle(): int
    {
        $count = 0;

        Courrier::query()
            ->where('statut', Courrier::STATUT_VALIDE)
            ->orderBy('id')
            ->chunkById(100, function ($courriers) use (&$count) {
                foreach ($courriers as $courrier) {
                    DB::transaction(function () use ($courrier, &$count) {
                        Archive::create([
                            'courrier_original_id' => $courrier->id,
                            'numero' => $courrier->numero,
                            'objet' => $courrier->objet,
                            'type' => $courrier->type,
                            'chemin_fichier' => $courrier->chemin_fichier,
                            'date_creation' => $courrier->date_creation,
                            'date_reception' => $courrier->date_reception,
                            'expediteur' => $courrier->expediteur,
                            'destinataire' => $courrier->destinataire,
                            'statut_original' => Courrier::STATUT_VALIDE,
                            'niveau_confidentialite_id' => $courrier->niveau_confidentialite_id,
                            'createur_id' => $courrier->createur_id,
                            'valideur_id' => $courrier->valideur_id,
                            'service_source_id' => $courrier->service_source_id,
                            'service_destinataire_id' => $courrier->service_destinataire_id,
                            'transmis_par_id' => $courrier->transmis_par_id,
                            'transmis_le' => $courrier->transmis_le,
                            'archive_par_id' => null,
                            'archive_le' => now(),
                            'motif' => 'Archivage automatique mensuel des courriers valides',
                        ]);

                        $courrier->delete();
                        $count++;
                    });
                }
            });

        $this->info("{$count} courrier(s) valide(s) archive(s).");

        return self::SUCCESS;
    }
}
