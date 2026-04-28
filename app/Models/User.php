<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * Les rôles disponibles pour les utilisateurs.
     */
    public const ROLE_ADMIN = 'admin';
    public const ROLE_CHEF = 'chef';
    public const ROLE_SECRETAIRE = 'secretaire';

    /**
     * Les attributs pouvant être assignés en masse.
     *
     * @var array<string>
     */
    protected $fillable = [
        'name',
        'nom',
        'prenom',
        'email',
        'password',
        'actif',
        'role',
        'service_id',
        'niveau_confidentialite_id',
    ];

    /**
     * Les attributs qui doivent être cachés lors de la sérialisation.
     *
     * @var array<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Les attributs qui doivent être convertis.
     *
     * @return array<string, string>
     */
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

    /**
     * Relation : un utilisateur appartient à un service.
     */
    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class);
    }

    /**
     * Relation : un utilisateur a un niveau de confidentialité.
     */
    public function niveauConfidentialite(): BelongsTo
    {
        return $this->belongsTo(NiveauConfidentialite::class);
    }

    /**
     * Relation : un utilisateur peut avoir créé plusieurs courriers.
     */
    public function courriersCreés(): HasMany
    {
        return $this->hasMany(Courrier::class, 'createur_id');
    }

    /**
     * Relation : un utilisateur peut avoir validé plusieurs courriers.
     */
    public function courriersValidés(): HasMany
    {
        return $this->hasMany(Courrier::class, 'valideur_id');
    }

    /**
     * Relation : un utilisateur peut être émetteur de plusieurs messages.
     */
    public function messagesEnvoyés(): HasMany
    {
        return $this->hasMany(Message::class, 'emetteur_id');
    }

    /**
     * Relation : un utilisateur peut être destinataire de plusieurs messages.
     */
    public function messagesReçus(): HasMany
    {
        return $this->hasMany(Message::class, 'destinataire_id');
    }

    /**
     * Vérifie si l'utilisateur est un administrateur.
     */
    public function estAdmin(): bool
    {
        return $this->role === self::ROLE_ADMIN;
    }

    /**
     * Vérifie si l'utilisateur est un chef de service.
     */
    public function estChef(): bool
    {
        return $this->role === self::ROLE_CHEF;
    }

    /**
     * Vérifie si l'utilisateur est un secréstaire.
     */
    public function estSecretaire(): bool
    {
        return $this->role === self::ROLE_SECRETAIRE;
    }

    /**
     * Vérifie si l'utilisateur peut créer des courriers (admin ou secretaire).
     */
    public function peutCreerCourrier(): bool
    {
        return $this->estAdmin() || $this->estSecretaire();
    }

    /**
     * Retourne le nom complet de l'utilisateur.
     */
    public function getNomCompletAttribute(): string
    {
        return $this->prenom . ' ' . $this->nom;
    }

    /**
     * Compatibilite avec les formulaires Laravel Breeze qui utilisent "name".
     */
    public function getNameAttribute(): string
    {
        return trim($this->prenom . ' ' . $this->nom);
    }

    /**
     * Convertit le champ "name" en prenom/nom pour le schema metier.
     */
    public function setNameAttribute(?string $value): void
    {
        $parts = preg_split('/\s+/', trim((string) $value), 2);

        $this->attributes['prenom'] = $parts[0] ?? '';
        $this->attributes['nom'] = $parts[1] ?? $parts[0] ?? '';
    }

    /**
     * Retourne le rang du niveau de confidentialité de l'utilisateur.
     */
    public function getRangNiveauConfidentialite(): int
    {
        return $this->niveauConfidentialite?->rang ?? 0;
    }
}
