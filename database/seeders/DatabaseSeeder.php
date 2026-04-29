<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Carbon\Carbon;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // ============================================================
        // 1. Niveaux de confidentialité (indispensables en premier)
        // ============================================================
        $niveaux = [
            ['libelle' => 'Public',       'rang' => 0, 'created_at' => now(), 'updated_at' => now()],
            ['libelle' => 'Confidentiel',  'rang' => 1, 'created_at' => now(), 'updated_at' => now()],
            ['libelle' => 'Secret',        'rang' => 2, 'created_at' => now(), 'updated_at' => now()],
        ];
        DB::table('niveau_confidentialites')->insert($niveaux);

        $niveauPublic       = 1; // id = 1 (Public)
        $niveauConfidentiel = 2;
        $niveauSecret       = 3;

        // ============================================================
        // 2. Services
        // ============================================================
        $services = [
            ['libelle' => 'Direction Générale',  'created_at' => now(), 'updated_at' => now()],
            ['libelle' => 'Ressources Humaines', 'created_at' => now(), 'updated_at' => now()],
            ['libelle' => 'Service Informatique', 'created_at' => now(), 'updated_at' => now()],
            ['libelle' => 'Service Comptabilité', 'created_at' => now(), 'updated_at' => now()],
        ];
        DB::table('services')->insert($services);

        $serviceDirection    = 1;
        $serviceRH           = 2;
        $serviceInformatique = 3;
        $serviceComptabilite = 4;

        // ============================================================
        // 3. Utilisateurs (avec rôles : admin, chef, secretaire)
        // ============================================================
        $users = [
            // Admin
            [
                'nom'                        => 'Admin',
                'prenom'                     => 'Système',
                'email'                      => 'admin@courrier.dz',
                'password'                   => Hash::make('password'),
                'actif'                      => true,
                'role'                       => 'admin',
                'service_id'                 => $serviceInformatique,
                'niveau_confidentialite_id'  => $niveauSecret,
                'created_at'                 => now(),
                'updated_at'                 => now(),
            ],
            // Chefs de service (4)
            [
                'nom'                        => 'Hadj',
                'prenom'                     => 'Ahmed',
                'email'                      => 'chef.direction@courrier.dz',
                'password'                   => Hash::make('password'),
                'actif'                      => true,
                'role'                       => 'chef',
                'service_id'                 => $serviceDirection,
                'niveau_confidentialite_id'  => $niveauConfidentiel,
                'created_at'                 => now(),
                'updated_at'                 => now(),
            ],
            [
                'nom'                        => 'Mansouri',
                'prenom'                     => 'Fatima',
                'email'                      => 'chef.rh@courrier.dz',
                'password'                   => Hash::make('password'),
                'actif'                      => true,
                'role'                       => 'chef',
                'service_id'                 => $serviceRH,
                'niveau_confidentialite_id'  => $niveauConfidentiel,
                'created_at'                 => now(),
                'updated_at'                 => now(),
            ],
            [
                'nom'                        => 'Belkacem',
                'prenom'                     => 'Mohamed',
                'email'                      => 'chef.info@courrier.dz',
                'password'                   => Hash::make('password'),
                'actif'                      => true,
                'role'                       => 'chef',
                'service_id'                 => $serviceInformatique,
                'niveau_confidentialite_id'  => $niveauConfidentiel,
                'created_at'                 => now(),
                'updated_at'                 => now(),
            ],
            [
                'nom'                        => 'Khelifi',
                'prenom'                     => 'Samira',
                'email'                      => 'chef.compta@courrier.dz',
                'password'                   => Hash::make('password'),
                'actif'                      => true,
                'role'                       => 'chef',
                'service_id'                 => $serviceComptabilite,
                'niveau_confidentialite_id'  => $niveauConfidentiel,
                'created_at'                 => now(),
                'updated_at'                 => now(),
            ],
            // Secrétaires (3)
            [
                'nom'                        => 'Saidi',
                'prenom'                     => 'Leila',
                'email'                      => 'secretaire.dir@courrier.dz',
                'password'                   => Hash::make('password'),
                'actif'                      => true,
                'role'                       => 'secretaire',
                'service_id'                 => $serviceDirection,
                'niveau_confidentialite_id'  => $niveauConfidentiel,
                'created_at'                 => now(),
                'updated_at'                 => now(),
            ],
            [
                'nom'                        => 'Toumi',
                'prenom'                     => 'Nadia',
                'email'                      => 'secretaire.rh@courrier.dz',
                'password'                   => Hash::make('password'),
                'actif'                      => true,
                'role'                       => 'secretaire',
                'service_id'                 => $serviceRH,
                'niveau_confidentialite_id'  => $niveauConfidentiel,
                'created_at'                 => now(),
                'updated_at'                 => now(),
            ],
            [
                'nom'                        => 'Boudiaf',
                'prenom'                     => 'Karim',
                'email'                      => 'secretaire.info@courrier.dz',
                'password'                   => Hash::make('password'),
                'actif'                      => true,
                'role'                       => 'secretaire',
                'service_id'                 => $serviceInformatique,
                'niveau_confidentialite_id'  => $niveauConfidentiel,
                'created_at'                 => now(),
                'updated_at'                 => now(),
            ],
        ];
        DB::table('users')->insert($users);

        // Récupérer les IDs des utilisateurs créés (par email)
        $admin = DB::table('users')->where('email', 'admin@courrier.dz')->first()->id;
        $chefDirection = DB::table('users')->where('email', 'chef.direction@courrier.dz')->first()->id;
        $chefInfo = DB::table('users')->where('email', 'chef.info@courrier.dz')->first()->id;
        $secretaireDir = DB::table('users')->where('email', 'secretaire.dir@courrier.dz')->first()->id;
        $secretaireRH = DB::table('users')->where('email', 'secretaire.rh@courrier.dz')->first()->id;
        $secretaireInfo = DB::table('users')->where('email', 'secretaire.info@courrier.dz')->first()->id;

        // ============================================================
        // 4. Courriers
        // ============================================================
        $courriers = [
            [
                'numero'                     => 'COUR-2025-0001',
                'objet'                      => 'Demande de congé annuel',
                'type'                       => 'entrant',
                'chemin_fichier'             => 'courriers/cour-0001.pdf',
                'date_creation'              => now()->subDays(10),
                'date_reception'             => now()->subDays(12),
                'expediteur'                 => 'Direction Centrale',
                'destinataire'               => null,
                'statut'                     => 'VALIDE',
                'niveau_confidentialite_id'  => $niveauPublic,
                'createur_id'                => $secretaireDir,
                'valideur_id'                => $chefDirection,
                'created_at'                 => now(),
                'updated_at'                 => now(),
            ],
            [
                'numero'                     => 'COUR-2025-0002',
                'objet'                      => 'Rapport financier confidentiel',
                'type'                       => 'entrant',
                'chemin_fichier'             => 'courriers/cour-0002.pdf',
                'date_creation'              => now()->subDays(5),
                'date_reception'             => now()->subDays(6),
                'expediteur'                 => 'Banque Nationale',
                'destinataire'               => null,
                'statut'                     => 'CREE',
                'niveau_confidentialite_id'  => $niveauConfidentiel,
                'createur_id'                => $secretaireRH,
                'valideur_id'                => null,
                'created_at'                 => now(),
                'updated_at'                 => now(),
            ],
            [
                'numero'                     => 'COUR-2025-0003',
                'objet'                      => 'Note de service - Sécurité',
                'type'                       => 'entrant',
                'chemin_fichier'             => null,
                'date_creation'              => now()->subDays(2),
                'date_reception'             => now()->subDays(3),
                'expediteur'                 => 'Ministère',
                'destinataire'               => null,
                'statut'                     => 'RECU',
                'niveau_confidentialite_id'  => $niveauSecret,
                'createur_id'                => $secretaireInfo,
                'valideur_id'                => null,
                'created_at'                 => now(),
                'updated_at'                 => now(),
            ],
            [
                'numero'                     => 'COUR-2025-0004',
                'objet'                      => 'Commande de fournitures',
                'type'                       => 'sortant',
                'chemin_fichier'             => 'courriers/cour-0004.pdf',
                'date_creation'              => now()->subDays(1),
                'date_reception'             => now(),
                'expediteur'                 => 'Direction Generale',
                'destinataire'               => 'Fournisseur XYZ',
                'statut'                     => 'TRANSMIS',
                'niveau_confidentialite_id'  => $niveauPublic,
                'createur_id'                => $secretaireDir,
                'valideur_id'                => null,
                'created_at'                 => now(),
                'updated_at'                 => now(),
            ],
        ];
        DB::table('courriers')->insert($courriers);

        DB::table('archives')->insert([
            [
                'courrier_original_id'       => null,
                'numero'                     => 'COUR-2025-0005',
                'objet'                      => 'Archivage des dossiers 2024',
                'type'                       => 'sortant',
                'chemin_fichier'             => null,
                'date_creation'              => now()->subDays(30),
                'date_reception'             => now()->subDays(31),
                'expediteur'                 => 'Direction Generale',
                'destinataire'               => 'Archives Nationales',
                'statut_original'            => 'TRANSMIS',
                'niveau_confidentialite_id'  => $niveauPublic,
                'createur_id'                => $secretaireDir,
                'valideur_id'                => $chefDirection,
                'service_source_id'          => $serviceDirection,
                'service_destinataire_id'    => null,
                'transmis_par_id'            => $secretaireDir,
                'transmis_le'                => now()->subDays(29),
                'archive_par_id'             => $secretaireDir,
                'archive_le'                 => now()->subDays(29),
                'motif'                      => 'Archivage de reference',
                'created_at'                 => now(),
                'updated_at'                 => now(),
            ],
        ]);

        // Récupérer les IDs des courriers par numéro
        $cour1 = DB::table('courriers')->where('numero', 'COUR-2025-0001')->first()->id;
        $cour2 = DB::table('courriers')->where('numero', 'COUR-2025-0002')->first()->id;
        // Les autres courriers pour référence
        $cour3 = DB::table('courriers')->where('numero', 'COUR-2025-0003')->first()->id;

        // ============================================================
        // 5. Messages
        // ============================================================
        $messages = [
            [
                'contenu'         => 'Merci de traiter ce courrier en priorité.',
                'date_envoi'      => now()->subDays(9),
                'lu'              => true,
                'emetteur_id'     => $chefDirection,
                'destinataire_id' => $secretaireDir,
                'courrier_id'     => $cour1,
                'created_at'      => now(),
                'updated_at'      => now(),
            ],
            [
                'contenu'         => 'J\'ai vérifié, le rapport est complet.',
                'date_envoi'      => now()->subDays(4),
                'lu'              => false,
                'emetteur_id'     => $secretaireRH,
                'destinataire_id' => DB::table('users')->where('email', 'chef.direction@courrier.dz')->first()->id, // chef direction
                'courrier_id'     => $cour2,
                'created_at'      => now(),
                'updated_at'      => now(),
            ],
            [
                'contenu'         => 'Réunion demain à 10h pour les nouveaux courriers.',
                'date_envoi'      => now()->subDays(1),
                'lu'              => false,
                'emetteur_id'     => $chefDirection,
                'destinataire_id' => $secretaireDir,
                'courrier_id'     => null,
                'created_at'      => now(),
                'updated_at'      => now(),
            ],
            [
                'contenu'         => 'Nouveaux niveaux de confidentialité ajoutés.',
                'date_envoi'      => now()->subDays(3),
                'lu'              => true,
                'emetteur_id'     => $admin,
                'destinataire_id' => $chefInfo,
                'courrier_id'     => null,
                'created_at'      => now(),
                'updated_at'      => now(),
            ],
            [
                'contenu'         => 'Peux-tu me transmettre le courrier #COUR-2025-0003 ?',
                'date_envoi'      => now()->subHours(5),
                'lu'              => false,
                'emetteur_id'     => $secretaireDir,
                'destinataire_id' => $secretaireInfo,
                'courrier_id'     => null,
                'created_at'      => now(),
                'updated_at'      => now(),
            ],
        ];
        DB::table('messages')->insert($messages);
    }
}
