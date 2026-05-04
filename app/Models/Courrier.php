<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

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
        'sequence_number',
        'numero',
        'objet',
        'type',
        'courrier_type_id',
        'resume',
        'chemin_fichier',
        'date_creation',
        'date_reception',
        'expediteur',
        'destinataire',
        'source_id',
        'parent_courrier_id',
        'requiert_reponse',
        'delai_reponse_jours',
        'date_limite_reponse',
        'repondu_le',
        'mode_diffusion',
        'statut',
        'transmission_demandee',
        'service_source_id',
        'service_destinataire_id',
        'niveau_confidentialite_id',
        'createur_id',
        'valideur_id',
        'transmis_par_id',
        'transmis_le',
        'validation_parent_id',
    ];

    protected $casts = [
        'sequence_number' => 'integer',
        'date_creation' => 'datetime',
        'date_reception' => 'datetime',
        'requiert_reponse' => 'boolean',
        'delai_reponse_jours' => 'integer',
        'date_limite_reponse' => 'datetime',
        'repondu_le' => 'datetime',
        'transmission_demandee' => 'boolean',
        'transmis_le' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected $appends = [
        'url_fichier',
        'est_validable',
        'a_ete_repondu',
        'est_en_retard',
    ];

    /**
     * Logique automatique lors de la manipulation du modèle.
     * Gère la génération séquentielle des numéros et le calcul automatique des dates limites.
     */
    protected static function booted(): void
    {
        static::creating(function (self $courrier) {
            if (!$courrier->sequence_number) {
                $courrier->sequence_number = ((int) static::query()->lockForUpdate()->max('sequence_number')) + 1;
            }

            if (!$courrier->numero) {
                $courrier->numero = sprintf('COUR-%06d', $courrier->sequence_number);
            }

            if (!$courrier->date_creation) {
                $courrier->date_creation = now();
            }

            if ($courrier->requiert_reponse && $courrier->delai_reponse_jours && !$courrier->date_limite_reponse) {
                $courrier->date_limite_reponse = Carbon::parse($courrier->date_reception ?? now())
                    ->addDays($courrier->delai_reponse_jours);
            }
        });

        static::saved(function (self $courrier) {
            if ($courrier->parent_courrier_id) {
                static::query()
                    ->whereKey($courrier->parent_courrier_id)
                    ->whereNull('repondu_le')
                    ->update(['repondu_le' => now()]);
            }
        });
    }

    public function courrierType(): BelongsTo
    {
        return $this->belongsTo(CourrierType::class);
    }

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

    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class);
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_courrier_id');
    }

    public function validationParent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'validation_parent_id');
    }

    public function reponses(): HasMany
    {
        return $this->hasMany(self::class, 'parent_courrier_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(Message::class);
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(CourrierAttachment::class);
    }

    public function comments(): HasMany
    {
        return $this->hasMany(CourrierComment::class);
    }

    public function recipients(): HasMany
    {
        return $this->hasMany(CourrierRecipient::class);
    }

    public function concernedPeople(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'courrier_people')->withTimestamps();
    }

    /**
     * Scope permettant de filtrer les courriers visibles par un utilisateur donné.
     * Applique les règles de confidentialité et le rattachement hiérarchique (service/structure).
     */
    public function scopeVisiblePourUser(Builder $query, User $user): Builder
    {
        if ($user->estAdmin()) {
            return $query;
        }

        return $query->where(function (Builder $subQuery) use ($user) {
            $subQuery->where('createur_id', $user->id)
                ->orWhere('valideur_id', $user->id)
                ->orWhere('transmis_par_id', $user->id)
                ->orWhereHas('concernedPeople', fn(Builder $q) => $q->where('users.id', $user->id))
                ->orWhereHas('recipients', function (Builder $q) use ($user) {
                    $q->where('recipient_type', 'all')
                        ->orWhere(function (Builder $sub) use ($user) {
                            $sub->where('recipient_type', 'user')->where('user_id', $user->id);
                        })
                        ->orWhere(function (Builder $sub) use ($user) {
                            $sub->where('recipient_type', 'service')->where('service_id', $user->service_id);
                        })
                        ->orWhere(function (Builder $sub) use ($user) {
                            $sub->where('recipient_type', 'structure')->where('structure_id', $user->structure_id);
                        });
                });

            if ($user->service_id) {
                $subQuery->orWhere('service_source_id', $user->service_id)
                    ->orWhere('service_destinataire_id', $user->service_id)
                    ->orWhereHas('createur', fn(Builder $q) => $q->where('service_id', $user->service_id));
            }
        });
    }

    public function scopeNumero(Builder $query, ?string $numero): Builder
    {
        return $numero ? $query->where('numero', 'like', '%' . $numero . '%') : $query;
    }

    public function scopeObjet(Builder $query, ?string $objet): Builder
    {
        return $objet ? $query->where(function (Builder $subQuery) use ($objet) {
            $subQuery->where('objet', 'like', '%' . $objet . '%')
                ->orWhere('resume', 'like', '%' . $objet . '%');
        }) : $query;
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
        return $query->whereIn('statut', [self::STATUT_CREE, self::STATUT_NON_VALIDE]);
    }

    /**
     * Scope isolant les courriers en attente de validation par l'utilisateur (Chef).
     */
    public function scopeValidablesPourUser(Builder $query, User $user): Builder
    {
        if ($user->estAdmin() || $user->estChefGeneral()) {
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
                    ->orWhereHas('recipients', function (Builder $q) use ($user) {
                        $q->where(function (Builder $recipientQuery) use ($user) {
                            $recipientQuery->where('recipient_type', 'service')->where('service_id', $user->service_id)
                                ->orWhere('recipient_type', 'structure')->where('structure_id', $user->structure_id)
                                ->orWhere('recipient_type', 'all');
                        });
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
                    Carbon::parse($dates[0])->startOfDay(),
                    Carbon::parse($dates[1])->endOfDay(),
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

        return $query->whereDate('date_reception', Carbon::parse($dateReception));
    }

    public function scopeSearchAnyField(Builder $query, ?string $term): Builder
    {
        if (!$term) {
            return $query;
        }

        return $query->where(function (Builder $subQuery) use ($term) {
            $subQuery->where('numero', 'like', '%' . $term . '%')
                ->orWhere('objet', 'like', '%' . $term . '%')
                ->orWhere('resume', 'like', '%' . $term . '%')
                ->orWhere('expediteur', 'like', '%' . $term . '%')
                ->orWhere('destinataire', 'like', '%' . $term . '%')
                ->orWhere('statut', 'like', '%' . $term . '%');
        });
    }

    public function scopeResumeFullText(Builder $query, ?string $term): Builder
    {
        if (!$term) {
            return $query;
        }

        if (DB::getDriverName() === 'mysql') {
            return $query->whereFullText(['objet', 'resume'], $term);
        }

        return $query->where(function (Builder $subQuery) use ($term) {
            $subQuery->where('objet', 'like', '%' . $term . '%')
                ->orWhere('resume', 'like', '%' . $term . '%');
        });
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

        $sequenceNumber = $this->attributes['sequence_number'] ?? (((int) static::max('sequence_number')) + 1);
        $this->attributes['numero'] = sprintf('COUR-%06d', $sequenceNumber);
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
        return in_array($this->statut, [self::STATUT_CREE, self::STATUT_NON_VALIDE], true);
    }

    public function getEstValidableAttribute(): bool
    {
        return $this->estValidable();
    }

    public function getAEteReponduAttribute(): bool
    {
        return (bool) $this->repondu_le || $this->reponses()->exists();
    }

    /**
     * Définit qui peut répondre à un courrier entrant.
     * Logique :
     * 1. Le courrier doit être de type Entrant.
     * 2. Si envoyé à un utilisateur précis -> cet utilisateur.
     * 3. Si envoyé à un service -> tout membre du service destinataire.
     * 4. Si envoyé à une structure -> le chef doit d'abord le transmettre (pas de réponse directe).
     */
    public function peutEtreReponduPar(User $user): bool
    {
        if ($this->type !== self::TYPE_ENTRANT) {
            return false;
        }

        // Si l'utilisateur est nommément destinataire
        if ($this->recipients()->where('recipient_type', 'user')->where('user_id', $user->id)->exists()) {
            return true;
        }

        // Si le service de l'utilisateur est destinataire
        if ($user->service_id && $this->recipients()->where('recipient_type', 'service')->where('service_id', $user->service_id)->exists()) {
            return true;
        }

        return false;
    }

    public function getEstEnRetardAttribute(): bool
    {
        return $this->requiert_reponse
            && !$this->a_ete_repondu
            && $this->date_limite_reponse !== null
            && $this->date_limite_reponse->isPast();
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
        if (in_array($user->id, array_filter([$this->createur_id, $this->valideur_id, $this->transmis_par_id]), true)) {
            return true;
        }

        return $this->concernedPeople()->where('users.id', $user->id)->exists()
            || $this->recipients()->where('recipient_type', 'user')->where('user_id', $user->id)->exists();
    }

    public function niveauEstAutorisePour(User $user): bool
    {
        if (!$this->relationLoaded('niveauConfidentialite')) {
            $this->load('niveauConfidentialite');
        }

        return ($this->niveauConfidentialite?->rang ?? 0) <= $user->getRangNiveauConfidentialite();
    }

    /**
     * Détermine si un utilisateur peut voir l'existence d'un courrier (liste simplifiée).
     */
    public function peutVoirExistencePar(User $user): bool
    {
        if ($user->estAdmin()) {
            return true;
        }

        if ($this->estDirectementConcernePar($user) || $this->appartientAuServiceDe($user)) {
            return true;
        }

        return $this->recipients()->where(function (Builder $q) use ($user) {
            $q->where('recipient_type', 'all')
                ->orWhere(function (Builder $sub) use ($user) {
                    $sub->where('recipient_type', 'structure')->where('structure_id', $user->structure_id);
                })
                ->orWhere(function (Builder $sub) use ($user) {
                    $sub->where('recipient_type', 'service')->where('service_id', $user->service_id);
                })
                ->orWhere(function (Builder $sub) use ($user) {
                    $sub->where('recipient_type', 'user')->where('user_id', $user->id);
                });
        })->exists();
    }

    /**
     * Vérifie si l'utilisateur a le droit de consulter les détails profonds du courrier
     * (Résumé, pièces jointes, commentaires).
     */
    public function peutEtreVuEnDetailPar(User $user): bool
    {
        if ($user->estAdmin() || $user->estChefGeneral()) {
            return true;
        }

        if ($user->estChef()) {
            return $this->estDirectementConcernePar($user) || $this->appartientAuServiceDe($user);
        }

        if ($this->estDirectementConcernePar($user)) {
            return true;
        }

        if ($this->appartientAuServiceDe($user)) {
            return $this->niveauEstAutorisePour($user);
        }

        return false;
    }

    public function peutEtreArchivePar(User $user): bool
    {
        if ($user->estAdmin()) {
            return true;
        }

        if (!$this->estArchivable()) {
            return false;
        }

        if ($this->requiert_reponse && !$this->a_ete_repondu) {
            return false;
        }

        return $this->createur_id === $user->id || $this->appartientAuServiceDe($user);
    }

    public function peutEtreValidePar(User $user): bool
    {
        if (!$user->estChef() && !$user->estAdmin()) {
            return false;
        }

        if (!$this->estValidable()) {
            return false;
        }

        if ($user->estAdmin() || $user->estChefGeneral()) {
            return true;
        }

        if ($this->createur_id === $user->id) {
            return false;
        }

        return $this->appartientAuServiceDe($user)
            || ($user->structure_id !== null && $this->recipients()->where('recipient_type', 'structure')->where('structure_id', $user->structure_id)->exists());
    }

    public function peutEtreNonValidePar(User $user): bool
    {
        return $this->peutEtreValidePar($user);
    }

    public function peutEtreTransmisPar(User $user): bool
    {
        if ($user->estAdmin() || $user->estChefGeneral()) {
            return true;
        }

        if (!in_array($this->statut, [self::STATUT_VALIDE, self::STATUT_TRANSMIS, self::STATUT_RECU], true)) {
            return false;
        }

        if ($this->recipients()->where('recipient_type', 'user')->where('user_id', $user->id)->exists()) {
            return true;
        }

        if ($user->estChefStructure() || $user->estSecretaireStructure()) {
            if ($this->recipients()->where('recipient_type', 'structure')->where('structure_id', $user->structure_id)->exists()) {
                return true;
            }

            if ($this->service_destinataire_id !== null && $this->serviceDestinataire?->structure_id === $user->structure_id) {
                return true;
            }
        }

        if ($user->estChefService() || $user->estSecretaireService()) {
            if ($this->recipients()->where('recipient_type', 'service')->where('service_id', $user->service_id)->exists()) {
                return true;
            }

            if ($this->service_destinataire_id !== null && $this->service_destinataire_id === $user->service_id) {
                return true;
            }
        }

        return false;
    }

    public function estDestineAUneStructure(): bool
    {
        return $this->recipients()->where('recipient_type', 'structure')->exists();
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
        return $this->estTransmis() || $this->estRecu() || $this->estValide();
    }

    public function peutEtreSupprimePar(User $user): bool
    {
        if ($user->estAdmin()) {
            return true;
        }

        if (!in_array($this->statut, [self::STATUT_CREE, self::STATUT_NON_VALIDE], true)) {
            return false;
        }

        return $user->estSecretaire() && $this->createur_id === $user->id;
    }

    public function peutEtreModifiePar(User $user): bool
    {
        if ($user->estAdmin()) {
            return true;
        }

        if (in_array($this->statut, [self::STATUT_CREE, self::STATUT_NON_VALIDE], true)) {
            return $this->createur_id === $user->id;
        }

        if ($this->statut !== self::STATUT_VALIDE) {
            return false;
        }

        return $user->estChef() && ($this->appartientAuServiceDe($user) || $this->createur_id === $user->id);
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
