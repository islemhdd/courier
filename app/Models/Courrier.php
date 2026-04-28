<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Auth;

/**
 * Modèle représentant un courrier dans le système de gestion.
 *
 * @property int $id
 * @property string $numero
 * @property string $objet
 * @property string $type
 * @property string|null $chemin_fichier
 * @property \Carbon\Carbon $date_creation
 * @property \Carbon\Carbon $date_reception
 * @property string $expediteur
 * @property string $statut
 * @property int $niveau_confidentialite_id
 * @property int $createur_id
 * @property int|null $valideur_id
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class Courrier extends Model
{
    /**
     * Les statuts disponibles pour un courrier.
     */
    public const STATUT_CREE = 'CREE';
    public const STATUT_RECU = 'RECU';
    public const STATUT_TRANSMIS = 'TRANSMIS';
    public const STATUT_VALIDE = 'VALIDE';
    public const STATUT_ARCHIVE = 'ARCHIVE';

    /**
     * Les types de courriers.
     */
    public const TYPE_ENTRANT = 'entrant';
    public const TYPE_SORTANT = 'sortant';

    /**
     * Les attributs pouvant être assignés en masse.
     *
     * @var array<string>
     */
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
        'niveau_confidentialite_id',
        'createur_id',
        'valideur_id',
    ];

    /**
     * Les attributs qui doivent être convertis.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'date_creation' => 'datetime',
        'date_reception' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Les attributs qui doivent être mutés (accesseurs).
     *
     * @var array<string, string>
     */
    protected $appends = [
        'est_accessible',
    ];

    /**
     * Relation : un courrier appartient à un niveau de confidentialité.
     */
    public function niveauConfidentialite(): BelongsTo
    {
        return $this->belongsTo(NiveauConfidentialite::class);
    }

    /**
     * Relation : un courrier appartient à un créateur (utilisateur).
     */
    public function createur(): BelongsTo
    {
        return $this->belongsTo(User::class, 'createur_id');
    }

    /**
     * Relation : un courrier peut avoir un valideur (utilisateur).
     */
    public function valideur(): BelongsTo
    {
        return $this->belongsTo(User::class, 'valideur_id');
    }

    /**
     * Relation : un courrier peut avoir plusieurs messages.
     */
    public function messages(): HasMany
    {
        return $this->hasMany(Message::class);
    }

    /**
     * Scope : filtre les courriers visibles pour un utilisateur donné.
     *
     * Règles de visibilité :
     * - admin : voit tous les courriers
     * - chef : voit les courriers créés par les utilisateurs de son service
     * - secretaire : voit ses propres courriers OU les courriers dont le niveau de confidentialité est ≤ au sien
     */
    public function scopeVisiblePourUser(Builder $query, User $user): Builder
    {
        if ($user->estAdmin()) {
            return $query;
        }

        if ($user->estChef()) {
            return $query->whereHas('createur', function (Builder $subQuery) use ($user) {
                $subQuery->where('service_id', $user->service_id);
            });
        }

        if ($user->estSecretaire()) {
            return $query->where(function (Builder $subQuery) use ($user) {
                $subQuery->where('createur_id', $user->id)
                    ->orWhereHas('niveauConfidentialite', function (Builder $niveauQuery) use ($user) {
                        $niveauQuery->where('rang', '<=', $user->getRangNiveauConfidentialite());
                    });
            });
        }

        return $query->whereRaw('1 = 0'); // Par défaut, aucun accès
    }

    /**
     * Scope : filtre les courriers par numéro (recherche partielle).
     */
    public function scopeNumero(Builder $query, ?string $numero): Builder
    {
        if (!$numero) {
            return $query;
        }

        return $query->where('numero', 'like', '%' . $numero . '%');
    }

    /**
     * Scope : filtre les courriers par objet (recherche partielle).
     */
    public function scopeObjet(Builder $query, ?string $objet): Builder
    {
        if (!$objet) {
            return $query;
        }

        return $query->where('objet', 'like', '%' . $objet . '%');
    }

    /**
     * Scope : filtre les courriers par expéditeur (recherche partielle).
     */
    public function scopeExpediteur(Builder $query, ?string $expediteur): Builder
    {
        if (!$expediteur) {
            return $query;
        }

        return $query->where('expediteur', 'like', '%' . $expediteur . '%');
    }

    /**
     * Scope : filtre les courriers par destinataire (recherche partielle).
     */
    public function scopeDestinataire(Builder $query, ?string $destinataire): Builder
    {
        if (!$destinataire) {
            return $query;
        }

        return $query->where('destinataire', 'like', '%' . $destinataire . '%');
    }

    /**
     * Scope : filtre les courriers par statut.
     */
    public function scopeStatut(Builder $query, ?string $statut): Builder
    {
        if (!$statut) {
            return $query;
        }

        return $query->where('statut', $statut);
    }

    /**
     * Scope : filtre les courriers par type.
     */
    public function scopeType(Builder $query, ?string $type): Builder
    {
        if (!$type) {
            return $query;
        }

        return $query->where('type', $type);
    }

    /**
     * Scope : filtre les courriers par niveau de confidentialité.
     */
    public function scopeNiveauConfidentialite(Builder $query, ?int $niveauId): Builder
    {
        if (!$niveauId) {
            return $query;
        }

        return $query->where('niveau_confidentialite_id', $niveauId);
    }

    /**
     * Scope : filtre les courriers par date de réception.
     * Supporte : date exacte, mois (format YYYY-MM), année (format YYYY), ou intervalle.
     */
    public function scopeDateReception(Builder $query, ?string $dateReception): Builder
    {
        if (!$dateReception) {
            return $query;
        }

        // Vérifier si c'est un intervalle (deux dates séparées par |)
        if (str_contains($dateReception, '|')) {
            $dates = explode('|', $dateReception);
            if (count($dates) === 2) {
                return $query->whereBetween('date_reception', [
                    \Carbon\Carbon::parse($dates[0])->startOfDay(),
                    \Carbon\Carbon::parse($dates[1])->endOfDay()
                ]);
            }
        }

        // Vérifier si c'est une année (4 chiffres)
        if (preg_match('/^\d{4}$/', $dateReception)) {
            return $query->whereYear('date_reception', $dateReception);
        }

        // Vérifier si c'est un mois (YYYY-MM)
        if (preg_match('/^\d{4}-\d{2}$/', $dateReception)) {
            return $query->whereYear('date_reception', substr($dateReception, 0, 4))
                ->whereMonth('date_reception', substr($dateReception, 5, 2));
        }

        // Sinon, date exacte
        return $query->whereDate('date_reception', \Carbon\Carbon::parse($dateReception));
    }

    /**
     * Accesseur : détermine si le courrier est accessible pour l'utilisateur connecté.
     */
    public function getEstAccessibleAttribute(): bool
    {
        $user = Auth::user();

        if (!$user) {
            return false;
        }

        // L'admin a toujours accès
        if ($user->estAdmin()) {
            return true;
        }

        // Vérifier le niveau de confidentialité
        $rangCourrier = $this->niveauConfidentialite?->rang ?? 0;
        $rangUser = $user->getRangNiveauConfidentialite();

        return $rangCourrier <= $rangUser;
    }

    /**
     * Mutateur : génère automatiquement le numéro du courrier.
     */
    public function setNumeroAttribute(?string $value): void
    {
        if (!$value) {
            $annee = date('Y');
            $caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            $random = '';
            for ($i = 0; $i < 8; $i++) {
                $random .= $caracteres[rand(0, strlen($caracteres) - 1)];
            }
            $this->attributes['numero'] = 'COUR-' . $annee . '-' . $random;
        } else {
            $this->attributes['numero'] = $value;
        }
    }

    /**
     * Mutateur : définit le statut par défaut à la création.
     */
    public function setStatutAttribute(?string $value): void
    {
        $this->attributes['statut'] = $value ?? self::STATUT_CREE;
    }

    /**
     * Mutateur : définit la date de création par défaut.
     */
    public function setDateCreationAttribute(?string $value): void
    {
        $this->attributes['date_creation'] = $value ?? now();
    }

    /**
     * Vérifie si le courrier peut être archivé par l'utilisateur donné.
     */
   public function peutEtreArchivePar(User $user): bool
{
    return $user->estAdmin() || $this->createur_id === $user->id;
}

public function peutEtreValidePar(User $user): bool
{
    if (!$user->estChef() && !$user->estAdmin()) {
        return false;
    }

    if ($user->estAdmin()) {
        return true;
    }

    if (!$this->createur) {
        $this->load('createur');
    }

    if (!$this->createur) {
        return false;
    }

    return $this->createur->service_id === $user->service_id;
}

    /**
     * Retourne l'URL du fichier associé au courrier.
     */
    public function getUrlFichierAttribute(): ?string
    {
        if (!$this->chemin_fichier) {
            return null;
        }

        return asset('storage/' . $this->chemin_fichier);
    }

    /**
     * Retourne le chemin relatif du fichier pour le stockage.
     */
    public function getCheminFichierStorageAttribute(): string
    {
        return 'courriers/' . basename($this->chemin_fichier ?? '');
    }
}
