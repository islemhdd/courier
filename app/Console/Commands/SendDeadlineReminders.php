<?php

namespace App\Console\Commands;

use App\Models\Courrier;
use App\Models\User;
use App\Notifications\CourrierDeadlineNotification;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Notification;

class SendDeadlineReminders extends Command
{
    protected $signature = 'courriers:deadline-rappels {--days=3 : Nombre de jours avant la date limite pour envoyer le rappel}
                                                   {--include-overdue : Inclure les courriers en retard}';

    protected $description = 'Envoie des notifications de rappel pour les courriers avec délai de réponse approchant ou dépassé';

    public function handle(): int
    {
        $thresholdDays = (int) $this->option('days');
        $includeOverdue = (bool) $this->option('include-overdue');
        $now = Carbon::now();

        $query = Courrier::query()
            ->where('requiert_reponse', true)
            ->whereNull('repondu_le')
            ->whereDoesntHave('reponses')
            ->whereNotNull('date_limite_reponse');

        $query->where(function ($q) use ($now, $thresholdDays) {
            $q->whereBetween('date_limite_reponse', [$now, $now->copy()->addDays($thresholdDays)]);

            if ($this->option('include-overdue')) {
                $q->orWhere('date_limite_reponse', '<', $now);
            }
        });

        $courriers = $query->get();

        if ($courriers->isEmpty()) {
            $this->info('Aucun courrier avec délai approchant trouvé.');

            return Command::SUCCESS;
        }

        $this->info('Traitement de ' . $courriers->count() . ' courrier(s)...');
        $totalNotifications = 0;

        foreach ($courriers as $courrier) {
            $joursRestants = $now->startOfDay()->diffInDays($courrier->date_limite_reponse->startOfDay(), false);
            $users = $this->getConcernedUsers($courrier);

            if ($users->isNotEmpty()) {
                Notification::send($users, new CourrierDeadlineNotification($courrier, $joursRestants));
                $totalNotifications += $users->count();
                $this->line('  -> Courrier ' . $courrier->numero . ' : ' . $users->count() . ' notification(s) envoyée(s)');
            }
        }

        $this->info($totalNotifications . ' notification(s) de délai envoyée(s).');

        return Command::SUCCESS;
    }

    private function getConcernedUsers(Courrier $courrier): \Illuminate\Support\Collection
    {
        if ($courrier->recipients()->where('recipient_type', 'all')->exists()) {
            return User::where('actif', true)->get();
        }

        $recipients = $courrier->recipients()->get();
        $userIds = $recipients->where('recipient_type', 'user')->pluck('user_id')->filter()->unique()->all();
        $serviceIds = $recipients->where('recipient_type', 'service')->pluck('service_id')->filter()->unique()->all();
        $structureIds = $recipients->where('recipient_type', 'structure')->pluck('structure_id')->filter()->unique()->all();

        $userIds = array_unique(array_filter($userIds));
        $serviceIds = array_unique(array_filter($serviceIds));
        $structureIds = array_unique(array_filter($structureIds));

        if (empty($userIds) && empty($serviceIds) && empty($structureIds)) {
            return collect();
        }

        return User::where('actif', true)
            ->where(function ($query) use ($userIds, $serviceIds, $structureIds) {
                if (!empty($userIds)) {
                    $query->orWhereIn('id', $userIds);
                }
                if (!empty($serviceIds)) {
                    $query->orWhereIn('service_id', $serviceIds);
                }
                if (!empty($structureIds)) {
                    $query->orWhereIn('structure_id', $structureIds);
                }
            })
            ->get()
            ->unique('id')
            ->values();
    }
}
