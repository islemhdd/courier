<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Auth;

class Archive extends Model
{
    protected $fillable = [
        'courrier_original_id',
        'numero',
        'objet',
        'type',
        'chemin_fichier',
        'date_creation',
        'date_reception',
        'expediteur',
        'destinataire',
        'statut_original',
        'niveau_confidentialite_id',
        'createur_id',
        'valideur_id',
        'service_source_id',
        'service_destinataire_id',
        'transmis_par_id',
        'transmis_le',
        'archive_par_id',
        'archive_le',
        'motif',
    ];

    protected $casts = [
        'date_creation' => 'datetime',
        'date_reception' => 'datetime',
        'transmis_le' => 'datetime',
        'archive_le' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected $appends = [
        'url_fichier',
    ];

    public function niveauConfidentialite(): BelongsTo
    {
        return $this->belongsTo(NiveauConfidentialite::class);
    }

    public function createur(): BelongsTo
    {
        return $this->belongsTo(User::class, 'createur_id');
    }

    public function valideur(): BelongsTo
    {
        return $this->belongsTo(User::class, 'valideur_id');
    }

    public function serviceSource(): BelongsTo
    {
        return $this->belongsTo(Service::class, 'service_source_id');
    }

    public function serviceDestinataire(): BelongsTo
    {
        return $this->belongsTo(Service::class, 'service_destinataire_id');
    }

    public function transmisPar(): BelongsTo
    {
        return $this->belongsTo(User::class, 'transmis_par_id');
    }

    public function archivePar(): BelongsTo
    {
        return $this->belongsTo(User::class, 'archive_par_id');
    }

    public function scopeVisiblePourUser(Builder $query, User $user): Builder
    {
        if ($user->estAdmin()) {
            return $query;
        }

        if ($user->estChef()) {
            return $query->where(function (Builder $subQuery) use ($user) {
                $subQuery->where('service_source_id', $user->service_id)
                    ->orWhere('service_destinataire_id', $user->service_id)
                    ->orWhereHas('createur', function (Builder $userQuery) use ($user) {
                        $userQuery->where('service_id', $user->service_id);
                    });
            });
        }

        if ($user->estSecretaire()) {
            return $query->where(function (Builder $subQuery) use ($user) {
                $subQuery->where('service_source_id', $user->service_id)
                    ->orWhere('service_destinataire_id', $user->service_id)
                    ->orWhereHas('createur', function (Builder $userQuery) use ($user) {
                        $userQuery->where('service_id', $user->service_id);
                    });
            });
        }

        return $query->whereRaw('1 = 0');
    }

    public function niveauEstAutorisePour(User $user): bool
    {
        if (!$this->relationLoaded('niveauConfidentialite')) {
            $this->load('niveauConfidentialite');
        }

        $rangArchive = $this->niveauConfidentialite?->rang ?? 0;

        return $rangArchive <= $user->getRangNiveauConfidentialite();
    }

    public function appartientAuPerimetreDe(User $user): bool
    {
        if ($this->service_source_id && $this->service_source_id === $user->service_id) {
            return true;
        }

        if ($this->service_destinataire_id && $this->service_destinataire_id === $user->service_id) {
            return true;
        }

        if (!$this->relationLoaded('createur')) {
            $this->load('createur');
        }

        return (bool) $this->createur && $this->createur->service_id === $user->service_id;
    }

    public function peutVoirExistencePar(User $user): bool
    {
        if ($user->estAdmin()) {
            return true;
        }

        if ($user->estChef()) {
            return $this->appartientAuPerimetreDe($user);
        }

        return $user->estSecretaire() && $this->appartientAuPerimetreDe($user);
    }

    public function peutEtreVuEnDetailPar(User $user): bool
    {
        if ($user->estAdmin()) {
            return true;
        }

        if ($user->estChef()) {
            return $this->appartientAuPerimetreDe($user);
        }

        return $user->estSecretaire()
            && $this->appartientAuPerimetreDe($user)
            && $this->niveauEstAutorisePour($user);
    }

    public function peutEtreSupprimePar(User $user): bool
    {
        return $user->estAdmin();
    }

    public function getEstAccessibleAttribute(): bool
    {
        if (array_key_exists('est_accessible', $this->attributes)) {
            return (bool) $this->attributes['est_accessible'];
        }

        $user = Auth::user();

        return $user ? $this->peutEtreVuEnDetailPar($user) : false;
    }

    public function getPeutVoirDetailsAttribute(): bool
    {
        if (array_key_exists('peut_voir_details', $this->attributes)) {
            return (bool) $this->attributes['peut_voir_details'];
        }

        return $this->est_accessible;
    }

    public function getPeutVoirExistenceAttribute(): bool
    {
        if (array_key_exists('peut_voir_existence', $this->attributes)) {
            return (bool) $this->attributes['peut_voir_existence'];
        }

        $user = Auth::user();

        return $user ? $this->peutVoirExistencePar($user) : false;
    }

    public function getContenuRestreintAttribute(): bool
    {
        if (array_key_exists('contenu_restreint', $this->attributes)) {
            return (bool) $this->attributes['contenu_restreint'];
        }

        return !$this->est_accessible;
    }

    public function getUrlFichierAttribute(): ?string
    {
        if (!$this->chemin_fichier) {
            return null;
        }

        return asset('storage/' . $this->chemin_fichier);
    }
}
