<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Auth;

class Courrier extends Model
{
    public const STATUT_CREE = 'CREE';
    public const STATUT_NON_VALIDE = 'NON_VALIDE';
    public const STATUT_VALIDE = 'VALIDE';
    public const STATUT_TRANSMIS = 'TRANSMIS';
    public const STATUT_RECU = 'RECU';
    public const STATUTS = [
        self::STATUT_CREE,
        self::STATUT_NON_VALIDE,
        self::STATUT_VALIDE,
        self::STATUT_TRANSMIS,
        self::STATUT_RECU,
    ];

    public const TYPE_ENTRANT = 'entrant';
    public const TYPE_SORTANT = 'sortant';

    protected $fillable = [
        'numero',
        'objet',
        'type',
        'chemin_fichier',
        'date_creation',
        'date_reception',
        'expediteur',
        'destinataire',
        'statut',
        'transmission_demandee',
        'service_source_id',
        'service_destinataire_id',
        'niveau_confidentialite_id',
        'createur_id',
        'valideur_id',
        'transmis_par_id',
        'transmis_le',
    ];

    protected $casts = [
        'date_creation' => 'datetime',
        'date_reception' => 'datetime',
        'transmission_demandee' => 'boolean',
        'transmis_le' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected $appends = [
        'url_fichier',
        'est_validable',
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

    public function messages(): HasMany
    {
        return $this->hasMany(Message::class);
    }

    public function scopeVisiblePourUser(Builder $query, User $user): Builder
    {
        if ($user->estAdmin()) {
            return $query;
        }

        return $query->where(function (Builder $subQuery) use ($user) {
            if ($user->estChef()) {
                $subQuery->where('service_source_id', $user->service_id)
                    ->orWhere('service_destinataire_id', $user->service_id)
                    ->orWhereHas('createur', function (Builder $userQuery) use ($user) {
                        $userQuery->where('service_id', $user->service_id);
                    });

                return;
            }

            if ($user->estSecretaire()) {
                $subQuery->where('service_source_id', $user->service_id)
                    ->orWhere('service_destinataire_id', $user->service_id)
                    ->orWhereHas('createur', function (Builder $userQuery) use ($user) {
                        $userQuery->where('service_id', $user->service_id);
                    });
            }

            $subQuery->orWhere('createur_id', $user->id)
                ->orWhere('valideur_id', $user->id)
                ->orWhere('transmis_par_id', $user->id)
                ->orWhereHas('niveauConfidentialite', function (Builder $niveauQuery) use ($user) {
                    $niveauQuery->where('rang', '<=', $user->getRangNiveauConfidentialite());
                });
        });
    }

    public function scopeNumero(Builder $query, ?string $numero): Builder
    {
        return $numero ? $query->where('numero', 'like', '%' . $numero . '%') : $query;
    }

    public function scopeObjet(Builder $query, ?string $objet): Builder
    {
        return $objet ? $query->where('objet', 'like', '%' . $objet . '%') : $query;
    }

    public function scopeExpediteur(Builder $query, ?string $expediteur): Builder
    {
        return $expediteur ? $query->where('expediteur', 'like', '%' . $expediteur . '%') : $query;
    }

    public function scopeDestinataire(Builder $query, ?string $destinataire): Builder
    {
        return $destinataire ? $query->where('destinataire', 'like', '%' . $destinataire . '%') : $query;
    }

    public function scopeStatut(Builder $query, ?string $statut): Builder
    {
        return $statut ? $query->where('statut', $statut) : $query;
    }

    public function scopeType(Builder $query, ?string $type): Builder
    {
        return $type ? $query->where('type', $type) : $query;
    }

    public function scopeEnValidation(Builder $query): Builder
    {
        return $query->whereIn('statut', [
            self::STATUT_CREE,
            self::STATUT_NON_VALIDE,
        ]);
    }

    public function scopeValidablesPourUser(Builder $query, User $user): Builder
    {
        if ($user->estAdmin()) {
            return $query->enValidation();
        }

        if (!$user->estChef()) {
            return $query->whereRaw('1 = 0');
        }

        return $query->enValidation()
            ->where('createur_id', '!=', $user->id)
            ->where(function (Builder $subQuery) use ($user) {
                $subQuery->where('service_source_id', $user->service_id)
                    ->orWhere('service_destinataire_id', $user->service_id)
                    ->orWhereHas('createur', function (Builder $userQuery) use ($user) {
                        $userQuery->where('service_id', $user->service_id);
                    });
            });
    }

    public function scopeNiveauConfidentialite(Builder $query, ?int $niveauId): Builder
    {
        return $niveauId ? $query->where('niveau_confidentialite_id', $niveauId) : $query;
    }

    public function scopeDateReception(Builder $query, ?string $dateReception): Builder
    {
        if (!$dateReception) {
            return $query;
        }

        if (str_contains($dateReception, '|')) {
            $dates = explode('|', $dateReception);
            if (count($dates) === 2) {
                return $query->whereBetween('date_reception', [
                    \Carbon\Carbon::parse($dates[0])->startOfDay(),
                    \Carbon\Carbon::parse($dates[1])->endOfDay(),
                ]);
            }
        }

        if (preg_match('/^\d{4}$/', $dateReception)) {
            return $query->whereYear('date_reception', $dateReception);
        }

        if (preg_match('/^\d{4}-\d{2}$/', $dateReception)) {
            return $query->whereYear('date_reception', substr($dateReception, 0, 4))
                ->whereMonth('date_reception', substr($dateReception, 5, 2));
        }

        return $query->whereDate('date_reception', \Carbon\Carbon::parse($dateReception));
    }

    public function getEstAccessibleAttribute(): bool
    {
        if (array_key_exists('est_accessible', $this->attributes)) {
            return (bool) $this->attributes['est_accessible'];
        }

        $user = Auth::user();

        return $user ? $this->peutEtreVuEnDetailPar($user) : false;
    }

    public function setNumeroAttribute(?string $value): void
    {
        if ($value) {
            $this->attributes['numero'] = $value;
            return;
        }

        $annee = date('Y');
        $caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        $random = '';

        for ($i = 0; $i < 8; $i++) {
            $random .= $caracteres[rand(0, strlen($caracteres) - 1)];
        }

        $this->attributes['numero'] = 'COUR-' . $annee . '-' . $random;
    }

    public function setStatutAttribute(?string $value): void
    {
        $this->attributes['statut'] = $value ?? self::STATUT_CREE;
    }

    public function setDateCreationAttribute(?string $value): void
    {
        $this->attributes['date_creation'] = $value ?? now();
    }

    public function estValidable(): bool
    {
        return in_array($this->statut, [
            self::STATUT_CREE,
            self::STATUT_NON_VALIDE,
        ], true);
    }

    public function getEstValidableAttribute(): bool
    {
        return $this->estValidable();
    }

    public function appartientAuServiceDe(User $user): bool
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

    public function estDirectementConcernePar(User $user): bool
    {
        return in_array($user->id, array_filter([
            $this->createur_id,
            $this->valideur_id,
            $this->transmis_par_id,
        ]), true);
    }

    public function niveauEstAutorisePour(User $user): bool
    {
        if (!$this->relationLoaded('niveauConfidentialite')) {
            $this->load('niveauConfidentialite');
        }

        return ($this->niveauConfidentialite?->rang ?? 0) <= $user->getRangNiveauConfidentialite();
    }

    public function peutVoirExistencePar(User $user): bool
    {
        if ($user->estAdmin()) {
            return true;
        }

        if ($user->estChef()) {
            return $this->appartientAuServiceDe($user);
        }

        if ($this->estDirectementConcernePar($user)) {
            return true;
        }

        if ($this->appartientAuServiceDe($user)) {
            return true;
        }

        return $this->niveauEstAutorisePour($user);
    }

    public function peutEtreVuEnDetailPar(User $user): bool
    {
        if ($user->estAdmin()) {
            return true;
        }

        if ($user->estChef()) {
            return $this->appartientAuServiceDe($user);
        }

        if ($this->niveauEstAutorisePour($user)) {
            return true;
        }

        return $this->estDirectementConcernePar($user);
    }

    public function peutEtreArchivePar(User $user): bool
    {
        if ($user->estAdmin()) {
            return true;
        }

        if (!$this->estArchivable()) {
            return false;
        }

        return $this->createur_id === $user->id
            || $this->appartientAuServiceDe($user);
    }

    public function peutEtreValidePar(User $user): bool
    {
        if (!$user->estChef() && !$user->estAdmin()) {
            return false;
        }

        if (!$this->estValidable()) {
            return false;
        }

        if ($user->estAdmin()) {
            return true;
        }

        if ($this->createur_id === $user->id) {
            return false;
        }

        return $this->appartientAuServiceDe($user);
    }

    public function peutEtreNonValidePar(User $user): bool
    {
        return $this->peutEtreValidePar($user);
    }

    public function peutEtreTransmisPar(User $user): bool
    {
        if ($user->estAdmin()) {
            return true;
        }

        if ($this->statut !== self::STATUT_VALIDE) {
            return false;
        }

        if ($this->createur_id === $user->id) {
            return true;
        }

        return $user->estChef() && $this->appartientAuServiceDe($user);
    }

    public function estCree(): bool
    {
        return $this->statut === self::STATUT_CREE;
    }

    public function estNonValide(): bool
    {
        return $this->statut === self::STATUT_NON_VALIDE;
    }

    public function estValide(): bool
    {
        return $this->statut === self::STATUT_VALIDE;
    }

    public function estTransmis(): bool
    {
        return $this->statut === self::STATUT_TRANSMIS;
    }

    public function estRecu(): bool
    {
        return $this->statut === self::STATUT_RECU;
    }

    public function estArchivable(): bool
    {
        return $this->estTransmis() || $this->estRecu();
    }

    public function peutEtreSupprimePar(User $user): bool
    {
        if ($user->estAdmin()) {
            return true;
        }

        if (!in_array($this->statut, [
            self::STATUT_CREE,
            self::STATUT_NON_VALIDE,
        ], true)) {
            return false;
        }

        return $user->estSecretaire() && $this->createur_id === $user->id;
    }

    public function peutEtreModifiePar(User $user): bool
    {
        if ($user->estAdmin()) {
            return true;
        }

        if (in_array($this->statut, [
            self::STATUT_CREE,
            self::STATUT_NON_VALIDE,
        ], true)) {
            return $user->estSecretaire() && $this->createur_id === $user->id;
        }

        if ($this->statut !== self::STATUT_VALIDE) {
            return false;
        }

        return $user->estChef() && $this->appartientAuServiceDe($user);
    }

    public function getUrlFichierAttribute(): ?string
    {
        return $this->chemin_fichier ? asset('storage/' . $this->chemin_fichier) : null;
    }

    public function getCheminFichierStorageAttribute(): string
    {
        return 'courriers/' . basename($this->chemin_fichier ?? '');
    }
}
