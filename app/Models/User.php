<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    public const ROLE_ADMIN = 'admin';
    public const ROLE_CHEF = 'chef';
    public const ROLE_SECRETAIRE = 'secretaire';
    public const SCOPE_GENERAL = 'general';
    public const SCOPE_STRUCTURE = 'structure';
    public const SCOPE_SERVICE = 'service';
    public const ROLES = [
        self::ROLE_ADMIN,
        self::ROLE_CHEF,
        self::ROLE_SECRETAIRE,
    ];

    protected $fillable = [
        'name',
        'nom',
        'prenom',
        'email',
        'password',
        'actif',
        'role',
        'role_scope',
        'service_id',
        'structure_id',
        'niveau_confidentialite_id',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'actif' => 'boolean',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class);
    }

    public function structure(): BelongsTo
    {
        return $this->belongsTo(Structure::class);
    }

    public function niveauConfidentialite(): BelongsTo
    {
        return $this->belongsTo(NiveauConfidentialite::class);
    }

    public function courriersCrees(): HasMany
    {
        return $this->hasMany(Courrier::class, 'createur_id');
    }

    public function courriersValides(): HasMany
    {
        return $this->hasMany(Courrier::class, 'valideur_id');
    }

    public function messagesEnvoyes(): HasMany
    {
        return $this->hasMany(Message::class, 'emetteur_id');
    }

    public function messagesRecus(): HasMany
    {
        return $this->hasMany(Message::class, 'destinataire_id');
    }

    public function estAdmin(): bool
    {
        return $this->role === self::ROLE_ADMIN;
    }

    public function estChef(): bool
    {
        return $this->role === self::ROLE_CHEF;
    }

    public function estSecretaire(): bool
    {
        return $this->role === self::ROLE_SECRETAIRE;
    }

    /**
     * Identifie les utilisateurs de haut rang (Général) ayant autorité sur toute l'organisation.
     */
    public function estChefGeneral(): bool
    {
        return ($this->estChef() || $this->estAdmin()) && $this->role_scope === self::SCOPE_GENERAL;
    }

    public function estSecretaireGeneral(): bool
    {
        return $this->estSecretaire() && $this->role_scope === self::SCOPE_GENERAL;
    }

    public function estChefStructure(): bool
    {
        return $this->estChef() && $this->role_scope === self::SCOPE_STRUCTURE;
    }

    public function estSecretaireStructure(): bool
    {
        return $this->estSecretaire() && $this->role_scope === self::SCOPE_STRUCTURE;
    }

    public function estChefService(): bool
    {
        return $this->estChef() && $this->role_scope === self::SCOPE_SERVICE;
    }

    public function estSecretaireService(): bool
    {
        return $this->estSecretaire() && $this->role_scope === self::SCOPE_SERVICE;
    }

    public function peutCreerCourrier(): bool
    {
        return $this->estAdmin() || $this->estChef() || $this->estSecretaire();
    }

    public function peutAjouterSource(): bool
    {
        return $this->estChefGeneral() || $this->estSecretaireGeneral();
    }

    public function getNomCompletAttribute(): string
    {
        return trim($this->prenom . ' ' . $this->nom);
    }

    public function getNameAttribute(): string
    {
        return $this->nom_complet;
    }

    public function setNameAttribute(?string $value): void
    {
        $parts = preg_split('/\s+/', trim((string) $value), 2);
        $this->attributes['prenom'] = $parts[0] ?? '';
        $this->attributes['nom'] = $parts[1] ?? $parts[0] ?? '';
    }

    /**
     * Récupère le rang numérique de confidentialité pour comparer les accès.
     */
    public function getRangNiveauConfidentialite(): int
    {
        return $this->niveauConfidentialite?->rang ?? 0;
    }

    public function peutGererTousLesUtilisateurs(): bool
    {
        return $this->estAdmin() || $this->estChefGeneral();
    }

    public function peutConsulterUtilisateurs(): bool
    {
        return $this->estAdmin() || $this->estChef();
    }

    public function peutGererUtilisateursDuService(): bool
    {
        return $this->estChefService() && $this->service_id !== null;
    }

    /**
     * Logique de gestion hiérarchique : un chef peut gérer les agents 
     * de sa structure ou de son service uniquement.
     */
    public function peutGererUtilisateur(User $autre): bool
    {
        if ($this->estAdmin() || $this->estChefGeneral()) {
            return true;
        }

        if ($this->estChefStructure() && $this->structure_id !== null) {
            return $autre->structure_id === $this->structure_id && !$autre->estAdmin() && !$autre->estChefGeneral();
        }

        if (!$this->peutGererUtilisateursDuService()) {
            return false;
        }

        return $autre->service_id !== null && $autre->service_id === $this->service_id && !$autre->estAdmin();
    }

    public function scopeChefs(Builder $query): Builder
    {
        return $query->where('role', self::ROLE_CHEF);
    }

    public function scopeSecretaires(Builder $query): Builder
    {
        return $query->where('role', self::ROLE_SECRETAIRE);
    }
}
