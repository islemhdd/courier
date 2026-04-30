<?php

namespace App\Providers;

use App\Models\Courrier;
use App\Models\Message;
use App\Models\Service;
use App\Models\User;
use App\Policies\CourrierPolicy;
use App\Policies\MessagePolicy;
use App\Policies\ServicePolicy;
use App\Policies\UserPolicy;
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
        Service::class => ServicePolicy::class,
        User::class => UserPolicy::class,
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
            return $user->peutCreerCourrier();
        });

        // Gate pour vérifier si un utilisateur peut voir les détails d'un courrier
        Gate::define('courrier.view', function (User $user, Courrier $courrier) {
            return $courrier->peutVoirExistencePar($user);
        });

        // Gate pour archiver un courrier
        Gate::define('courrier.archiver', function (User $user, Courrier $courrier) {
            return $courrier->peutEtreArchivePar($user);
        });

        Gate::define('courrier.transmettre', function (User $user, Courrier $courrier) {
            return $courrier->peutEtreTransmisPar($user);
        });

        // Gate pour valider un courrier
        Gate::define('courrier.valider', function (User $user, Courrier $courrier) {
            return $courrier->peutEtreValidePar($user);
        });
    }
}
