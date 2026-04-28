<?php

namespace App\Providers;

use App\Models\Courrier;
use App\Models\Message;
use App\Models\User;
use App\Policies\CourrierPolicy;
use App\Policies\MessagePolicy;
use Illuminate\Foundation\Support\Providers\AuthServiceProvider as ServiceProvider;
use Illuminate\Support\Facades\Gate;

class AuthServiceProvider extends ServiceProvider
{
    /**
     * The model to policy mappings for the application.
     *
     * @var array<class-string, class-string>
     */
    protected $policies = [
        Courrier::class => CourrierPolicy::class,
        Message::class => MessagePolicy::class,
    ];

    /**
     * Register any authentication / authorization services.
     */
    public function boot(): void
    {
        $this->registerPolicies();

        // Définir des gates personnalisés pour les règles métier supplémentaires

        // Gate pour vérifier si un utilisateur peut créer un courrier
        Gate::define('courrier.create', function (User $user) {
            return $user->estAdmin() || $user->estSecretaire();
        });

        // Gate pour vérifier si un utilisateur peut voir les détails d'un courrier
        Gate::define('courrier.view', function (User $user, Courrier $courrier) {
            // L'admin a toujours accès
            if ($user->estAdmin()) {
                return true;
            }

            // Vérifier le niveau de confidentialité
            $rangCourrier = $courrier->niveauConfidentialite?->rang ?? 0;
            $rangUser = $user->getRangNiveauConfidentialite();

            if ($rangCourrier > $rangUser) {
                return false;
            }

            // Pour le chef, vérifier qu'il est dans le même service que le créateur
            if ($user->estChef()) {
                return $courrier->createur && $courrier->createur->service_id === $user->service_id;
            }

            // Pour le secretaire, vérifier qu'il a créé le courrier
            if ($user->estSecretaire()) {
                return $courrier->createur_id === $user->id;
            }

            return false;
        });

        // Gate pour archiver un courrier
        Gate::define('courrier.archiver', function (User $user, Courrier $courrier) {
            return $user->estAdmin() || $courrier->createur_id === $user->id;
        });

        // Gate pour valider un courrier
        Gate::define('courrier.valider', function (User $user, Courrier $courrier) {
            if (!$user->estChef()) {
                return false;
            }

            return $courrier->createur && $courrier->createur->service_id === $user->service_id;
        });
    }
}
