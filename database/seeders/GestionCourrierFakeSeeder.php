<?php

namespace Database\Seeders;

use Carbon\Carbon;
use Faker\Factory as Faker;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

class GestionCourrierFakeSeeder extends Seeder
{
    public function run(): void
    {
        $faker = Faker::create('fr_FR');

        /*
        |--------------------------------------------------------------------------
        | Quantités de fake data
        |--------------------------------------------------------------------------
        */
        $nombreUtilisateursFake = 120;
        $nombreCourriersFake = 500;

        /*
        |--------------------------------------------------------------------------
        | Nettoyage des anciennes données fake
        |--------------------------------------------------------------------------
        */
        Schema::disableForeignKeyConstraints();

        if (Schema::hasTable('courriers')) {
            DB::table('courriers')
                ->where('numero', 'like', 'COUR-FAKE-%')
                ->delete();
        }

        if (Schema::hasTable('users')) {
            DB::table('users')
                ->where('email', 'like', 'fake.%@courrier.dz')
                ->delete();
        }

        Schema::enableForeignKeyConstraints();

        /*
        |--------------------------------------------------------------------------
        | Niveaux de confidentialité
        |--------------------------------------------------------------------------
        */
        $niveaux = [
            ['libelle' => 'Public', 'rang' => 0],
            ['libelle' => 'Interne', 'rang' => 1],
            ['libelle' => 'Confidentiel', 'rang' => 2],
            ['libelle' => 'Secret', 'rang' => 3],
        ];

        foreach ($niveaux as $niveau) {
            DB::table('niveau_confidentialites')->updateOrInsert(
                ['libelle' => $niveau['libelle']],
                $this->onlyExistingColumns('niveau_confidentialites', [
                    'libelle' => $niveau['libelle'],
                    'rang' => $niveau['rang'],
                    'created_at' => now(),
                    'updated_at' => now(),
                ])
            );
        }

        $niveauxConf = DB::table('niveau_confidentialites')->orderBy('rang')->get();

        $niveauPublic = $niveauxConf->where('libelle', 'Public')->first();
        $niveauInterne = $niveauxConf->where('libelle', 'Interne')->first();
        $niveauConfidentiel = $niveauxConf->where('libelle', 'Confidentiel')->first();
        $niveauSecret = $niveauxConf->where('libelle', 'Secret')->first();

        /*
        |--------------------------------------------------------------------------
        | Services
        |--------------------------------------------------------------------------
        */
        $services = [
            'Direction Générale',
            'Ressources Humaines',
            'Service Informatique',
            'Service Comptabilité',
            'Secrétariat',
            'Archives',
            'Juridique',
            'Logistique',
            'Communication',
            'Achats',
            'Patrimoine',
            'Formation',
        ];

        foreach ($services as $service) {
            DB::table('services')->updateOrInsert(
                ['libelle' => $service],
                $this->onlyExistingColumns('services', [
                    'libelle' => $service,
                    'created_at' => now(),
                    'updated_at' => now(),
                ])
            );
        }

        $servicesCollection = DB::table('services')->get();

        $serviceDirection = $servicesCollection->where('libelle', 'Direction Générale')->first();
        $serviceRH = $servicesCollection->where('libelle', 'Ressources Humaines')->first();
        $serviceInfo = $servicesCollection->where('libelle', 'Service Informatique')->first();
        $serviceCompta = $servicesCollection->where('libelle', 'Service Comptabilité')->first();
        $serviceSecretariat = $servicesCollection->where('libelle', 'Secrétariat')->first();

        /*
        |--------------------------------------------------------------------------
        | Utilisateurs fixes pour tester
        |--------------------------------------------------------------------------
        | Mot de passe pour tous : password
        */
        $password = Hash::make('password');

        $fixedUsers = [
            [
                'nom' => 'Admin',
                'prenom' => 'Système',
                'email' => 'admin@courrier.dz',
                'password' => $password,
                'actif' => true,
                'role' => 'admin',
                'role_scope' => 'general',
                'service_id' => $serviceInfo->id,
                'niveau_confidentialite_id' => $niveauSecret->id,
            ],
            [
                'nom' => 'Chef',
                'prenom' => 'Général',
                'email' => 'chef.general@courrier.dz',
                'password' => $password,
                'actif' => true,
                'role' => 'chef',
                'role_scope' => 'general',
                'service_id' => $serviceDirection->id,
                'niveau_confidentialite_id' => $niveauSecret->id,
            ],
            [
                'nom' => 'Secrétaire',
                'prenom' => 'Général',
                'email' => 'secretaire.general@courrier.dz',
                'password' => $password,
                'actif' => true,
                'role' => 'secretaire',
                'role_scope' => 'general',
                'service_id' => $serviceDirection->id,
                'niveau_confidentialite_id' => $niveauConfidentiel->id,
            ],
            [
                'nom' => 'Chef',
                'prenom' => 'Direction',
                'email' => 'chef.direction@courrier.dz',
                'password' => $password,
                'actif' => true,
                'role' => 'chef',
                'role_scope' => 'service',
                'service_id' => $serviceDirection->id,
                'niveau_confidentialite_id' => $niveauSecret->id,
            ],
            [
                'nom' => 'Chef',
                'prenom' => 'RH',
                'email' => 'chef.rh@courrier.dz',
                'password' => $password,
                'actif' => true,
                'role' => 'chef',
                'role_scope' => 'service',
                'service_id' => $serviceRH->id,
                'niveau_confidentialite_id' => $niveauConfidentiel->id,
            ],
            [
                'nom' => 'Chef',
                'prenom' => 'Informatique',
                'email' => 'chef.info@courrier.dz',
                'password' => $password,
                'actif' => true,
                'role' => 'chef',
                'role_scope' => 'service',
                'service_id' => $serviceInfo->id,
                'niveau_confidentialite_id' => $niveauConfidentiel->id,
            ],
            [
                'nom' => 'Chef',
                'prenom' => 'Comptabilité',
                'email' => 'chef.compta@courrier.dz',
                'password' => $password,
                'actif' => true,
                'role' => 'chef',
                'role_scope' => 'service',
                'service_id' => $serviceCompta->id,
                'niveau_confidentialite_id' => $niveauConfidentiel->id,
            ],
            [
                'nom' => 'Secrétaire',
                'prenom' => 'Direction',
                'email' => 'secretaire.dir@courrier.dz',
                'password' => $password,
                'actif' => true,
                'role' => 'secretaire',
                'role_scope' => 'service',
                'service_id' => $serviceDirection->id,
                'niveau_confidentialite_id' => $niveauConfidentiel->id,
            ],
            [
                'nom' => 'Secrétaire',
                'prenom' => 'RH',
                'email' => 'secretaire.rh@courrier.dz',
                'password' => $password,
                'actif' => true,
                'role' => 'secretaire',
                'role_scope' => 'service',
                'service_id' => $serviceRH->id,
                'niveau_confidentialite_id' => $niveauConfidentiel->id,
            ],
            [
                'nom' => 'Secrétaire',
                'prenom' => 'Informatique',
                'email' => 'secretaire.info@courrier.dz',
                'password' => $password,
                'actif' => true,
                'role' => 'secretaire',
                'role_scope' => 'service',
                'service_id' => $serviceInfo->id,
                'niveau_confidentialite_id' => $niveauConfidentiel->id,
            ],
            [
                'nom' => 'Secrétaire',
                'prenom' => 'Principal',
                'email' => 'secretaire@courrier.dz',
                'password' => $password,
                'actif' => true,
                'role' => 'secretaire',
                'role_scope' => 'service',
                'service_id' => $serviceSecretariat->id,
                'niveau_confidentialite_id' => $niveauConfidentiel->id,
            ],
        ];

        foreach ($fixedUsers as $user) {
            DB::table('users')->updateOrInsert(
                ['email' => $user['email']],
                $this->onlyExistingColumns('users', array_merge($user, [
                    'created_at' => now(),
                    'updated_at' => now(),
                ]))
            );
        }

        /*
        |--------------------------------------------------------------------------
        | Beaucoup d'utilisateurs fake
        |--------------------------------------------------------------------------
        | Ton projet utilise seulement ces rôles :
        | admin, chef, secretaire
        */
        $usersToInsert = [];

        for ($i = 1; $i <= $nombreUtilisateursFake; $i++) {
            $service = $servicesCollection->random();
            $niveau = $niveauxConf->random();

            $usersToInsert[] = $this->onlyExistingColumns('users', [
                'nom' => $faker->lastName(),
                'prenom' => $faker->firstName(),
                'email' => 'fake.user.' . $i . '@courrier.dz',
                'password' => $password,
                'actif' => $faker->boolean(95),
                'role' => $faker->randomElement(['chef', 'secretaire']),
                'service_id' => $service->id,
                'niveau_confidentialite_id' => $niveau->id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        foreach (array_chunk($usersToInsert, 100) as $chunk) {
            DB::table('users')->insert($chunk);
        }

        $usersCollection = DB::table('users')->get();
        $chefsCollection = $usersCollection->where('role', 'chef');

        $secretaireDir = DB::table('users')->where('email', 'secretaire.dir@courrier.dz')->first();
        $secretaireRH = DB::table('users')->where('email', 'secretaire.rh@courrier.dz')->first();
        $chefDirection = DB::table('users')->where('email', 'chef.direction@courrier.dz')->first();

        /*
        |--------------------------------------------------------------------------
        | Courriers fake
        |--------------------------------------------------------------------------
        */
        $statuts = [
            ['db' => 'CREE', 'label' => 'Créé'],
            ['db' => 'NON_VALIDE', 'label' => 'Non validé'],
            ['db' => 'VALIDE', 'label' => 'Validé'],
            ['db' => 'TRANSMIS', 'label' => 'Transmis'],
            ['db' => 'RECU', 'label' => 'Reçu'],
        ];

        $objets = [
            'Demande de congé annuel',
            'Rapport financier confidentiel',
            'Note de service interne',
            'Demande de matériel informatique',
            'Réclamation administrative',
            'Transmission de dossier',
            'Réponse officielle',
            'Convocation à une réunion',
            'Suivi de dossier important',
            'Demande de validation',
            'Notification de réception',
            'Rapport de sécurité',
            'Demande d’achat',
            'Fiche de renseignement',
            'Courrier urgent',
            'Dossier disciplinaire',
            'Instruction interne',
            'Mise à jour administrative',
            'Demande de classement',
            'Courrier confidentiel',
        ];

        $courriersToInsert = [];

        for ($i = 1; $i <= $nombreCourriersFake; $i++) {
            $statut = $faker->randomElement($statuts);

            $createur = $usersCollection->random();
            $valideur = $chefsCollection->random();

            $serviceSource = $servicesCollection->firstWhere('id', $createur->service_id) ?: $servicesCollection->random();
            $serviceDestinataire = $servicesCollection->random();
            $niveau = $niveauxConf->random();

            $dateCreation = Carbon::now()->subDays(rand(20, 300));
            $dateReception = (clone $dateCreation)->addDays(rand(1, 10));
            $dateValidation = null;
            $dateEnvoi = null;
            $transmisLe = null;
            $transmisParId = null;
            $valideurId = null;

            if (in_array($statut['db'], ['VALIDE', 'TRANSMIS', 'RECU'])) {
                $dateValidation = (clone $dateCreation)->addDays(rand(1, 5));
                $valideurId = $valideur->id;
            }

            if (in_array($statut['db'], ['TRANSMIS', 'RECU'])) {
                $dateEnvoi = (clone $dateCreation)->addDays(rand(2, 8));
                $transmisLe = $dateEnvoi;
                $transmisParId = $createur->id;
            }

            $numero = 'COUR-FAKE-' . str_pad($i, 5, '0', STR_PAD_LEFT);
            $type = $faker->randomElement(['entrant', 'sortant']);

            $courriersToInsert[] = $this->onlyExistingColumns('courriers', [
                'numero' => $numero,
                'objet' => $faker->randomElement($objets) . ' #' . $i,
                'contenu' => $faker->paragraphs(rand(2, 5), true),
                'type' => $type,
                'chemin_fichier' => $faker->boolean(70) ? 'courriers/' . strtolower($numero) . '.pdf' : null,

                'date_creation' => $dateCreation,
                'date_reception' => $dateReception,
                'date_validation' => $dateValidation,
                'date_envoi' => $dateEnvoi,

                'expediteur' => $type === 'entrant'
                    ? $faker->company()
                    : ($serviceSource->libelle ?? 'Service interne'),

                'destinataire' => $type === 'sortant'
                    ? $faker->company()
                    : ($serviceDestinataire->libelle ?? 'Service destinataire'),

                'statut' => $statut['db'],
                'etat' => $statut['label'],

                'niveau_confidentialite_id' => $niveau->id,
                'createur_id' => $createur->id,
                'valideur_id' => $valideurId,
                'service_source_id' => $serviceSource->id ?? null,
                'service_destinataire_id' => $serviceDestinataire->id ?? null,
                'transmis_par_id' => $transmisParId,
                'transmis_le' => $transmisLe,

                'created_at' => $dateCreation,
                'updated_at' => now(),
            ]);
        }

        foreach (array_chunk($courriersToInsert, 100) as $chunk) {
            DB::table('courriers')->insert($chunk);
        }

        /*
        |--------------------------------------------------------------------------
        | Courriers spéciaux pour tester tes règles
        |--------------------------------------------------------------------------
        */
        $courriersSpeciaux = [
            [
                'numero' => 'COUR-FAKE-TEST-001',
                'objet' => 'Test suppression secrétaire - courrier créé',
                'statut' => 'CREE',
                'etat' => 'Créé',
                'createur_id' => $secretaireDir->id,
                'valideur_id' => null,
                'service_source_id' => $serviceDirection->id,
                'service_destinataire_id' => $serviceRH->id,
                'niveau_confidentialite_id' => $niveauPublic->id,
                'transmis_par_id' => null,
                'transmis_le' => null,
                'date_validation' => null,
                'date_envoi' => null,
            ],
            [
                'numero' => 'COUR-FAKE-TEST-002',
                'objet' => 'Test suppression secrétaire - courrier non validé',
                'statut' => 'NON_VALIDE',
                'etat' => 'Non validé',
                'createur_id' => $secretaireDir->id,
                'valideur_id' => null,
                'service_source_id' => $serviceDirection->id,
                'service_destinataire_id' => $serviceInfo->id,
                'niveau_confidentialite_id' => $niveauInterne->id,
                'transmis_par_id' => null,
                'transmis_le' => null,
                'date_validation' => null,
                'date_envoi' => null,
            ],
            [
                'numero' => 'COUR-FAKE-TEST-003',
                'objet' => 'Test suppression refusée - courrier validé',
                'statut' => 'VALIDE',
                'etat' => 'Validé',
                'createur_id' => $secretaireDir->id,
                'valideur_id' => $chefDirection->id,
                'service_source_id' => $serviceDirection->id,
                'service_destinataire_id' => $serviceCompta->id,
                'niveau_confidentialite_id' => $niveauConfidentiel->id,
                'transmis_par_id' => null,
                'transmis_le' => null,
                'date_validation' => now()->subDays(5),
                'date_envoi' => null,
            ],
            [
                'numero' => 'COUR-FAKE-TEST-004',
                'objet' => 'Test contenu très confidentiel pour blur',
                'statut' => 'VALIDE',
                'etat' => 'Validé',
                'createur_id' => $secretaireRH->id,
                'valideur_id' => $chefDirection->id,
                'service_source_id' => $serviceRH->id,
                'service_destinataire_id' => $serviceDirection->id,
                'niveau_confidentialite_id' => $niveauSecret->id,
                'transmis_par_id' => null,
                'transmis_le' => null,
                'date_validation' => now()->subDays(4),
                'date_envoi' => null,
            ],
            [
                'numero' => 'COUR-FAKE-TEST-005',
                'objet' => 'Test transmission secrétaire - courrier transmis',
                'statut' => 'TRANSMIS',
                'etat' => 'Transmis',
                'createur_id' => $secretaireDir->id,
                'valideur_id' => $chefDirection->id,
                'service_source_id' => $serviceDirection->id,
                'service_destinataire_id' => $serviceInfo->id,
                'niveau_confidentialite_id' => $niveauInterne->id,
                'transmis_par_id' => $secretaireDir->id,
                'transmis_le' => now()->subDays(2),
                'date_validation' => now()->subDays(4),
                'date_envoi' => now()->subDays(2),
            ],
            [
                'numero' => 'COUR-FAKE-TEST-006',
                'objet' => 'Test réception courrier reçu',
                'statut' => 'RECU',
                'etat' => 'Reçu',
                'createur_id' => $secretaireDir->id,
                'valideur_id' => $chefDirection->id,
                'service_source_id' => $serviceDirection->id,
                'service_destinataire_id' => $serviceCompta->id,
                'niveau_confidentialite_id' => $niveauPublic->id,
                'transmis_par_id' => $secretaireDir->id,
                'transmis_le' => now()->subDays(3),
                'date_validation' => now()->subDays(5),
                'date_envoi' => now()->subDays(3),
            ],
        ];

        foreach ($courriersSpeciaux as $special) {
            $dateCreation = now()->subDays(rand(10, 30));

            DB::table('courriers')->updateOrInsert(
                ['numero' => $special['numero']],
                $this->onlyExistingColumns('courriers', array_merge([
                    'type' => 'entrant',
                    'chemin_fichier' => null,
                    'contenu' => 'Ceci est un contenu de test pour vérifier la confidentialité, le blur, la suppression et les statuts.',
                    'date_creation' => $dateCreation,
                    'date_reception' => (clone $dateCreation)->addDays(rand(1, 5)),
                    'expediteur' => 'Service test',
                    'destinataire' => 'Destinataire test',
                    'created_at' => $dateCreation,
                    'updated_at' => now(),
                ], $special))
            );
        }
    }

    private function onlyExistingColumns(string $table, array $data): array
    {
        return collect($data)
            ->filter(function ($value, $column) use ($table) {
                return Schema::hasColumn($table, $column);
            })
            ->toArray();
    }
}
