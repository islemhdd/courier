<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Builder;

/**
 * Modèle représentant un message dans le système de gestion de courriers.
 *
 * @property int $id
 * @property string $contenu
 * @property \Carbon\Carbon $date_envoi
 * @property bool $lu
 * @property string $statut
 * @property int $emetteur_id
 * @property int $destinataire_id
 * @property int|null $courrier_id
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class Message extends Model
{
    public const STATUT_CREE = 'CREE';
    public const STATUT_ENVOYE = 'ENVOYE';

    /**
     * Les attributs pouvant être assignés en masse.
     *
     * @var array<string>
     */
    protected $fillable = [
        'contenu',
        'date_envoi',
        'lu',
        'statut',
        'emetteur_id',
        'destinataire_id',
        'courrier_id',
    ];

    /**
     * Les attributs qui doivent être convertis.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'date_envoi' => 'datetime',
        'lu' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Relation : un message appartient à un émetteur (utilisateur).
     */
    public function emetteur(): BelongsTo
    {
        return $this->belongsTo(User::class, 'emetteur_id');
    }

    /**
     * Relation : un message appartient à un destinataire (utilisateur).
     */
    public function destinataire(): BelongsTo
    {
        return $this->belongsTo(User::class, 'destinataire_id');
    }

    /**
     * Relation : un message peut appartenir à un courrier (optionnel).
     */
    public function courrier(): BelongsTo
    {
        return $this->belongsTo(Courrier::class);
    }

    /**
     * Scope : filtre les messages reçus par un utilisateur.
     */
    public function scopeRecuPar(Builder $query, User $user): Builder
    {
        return $query->where('destinataire_id', $user->id);
    }

    /**
     * Scope : filtre les messages envoyés par un utilisateur.
     */
    public function scopeEnvoyéPar(Builder $query, User $user): Builder
    {
        return $query->where('emetteur_id', $user->id);
    }

    /**
     * Scope : filtre les messages non lus.
     */
    public function scopeNonLus(Builder $query): Builder
    {
        return $query->where('lu', false);
    }

    /**
     * Scope : filtre les messages liés à un courrier spécifique.
     */
    public function scopePourCourrier(Builder $query, int $courrierId): Builder
    {
        return $query->where('courrier_id', $courrierId);
    }

    /**
     * Mutateur : définit le statut lu par défaut.
     */
    public function setLuAttribute(?bool $value): void
    {
        $this->attributes['lu'] = $value ?? false;
    }

    /**
     * Marque le message comme lu.
     */
    public function marquerCommeLu(): void
    {
        $this->update(['lu' => true]);
    }

    /**
     * Vérifie si le message a été lu.
     */
    public function estLu(): bool
    {
        return $this->lu;
    }

    public function estBrouillon(): bool
    {
        return $this->statut === self::STATUT_CREE;
    }

    public function estEnvoye(): bool
    {
        return $this->statut === self::STATUT_ENVOYE;
    }

    /**
     * Vérifie si le destinataire peut voir le courrier associé.
     */
    public function destinatairePeutVoirCourrier(): bool
    {
        if (!$this->courrier) {
            return true;
        }

        $destinataire = $this->destinataire;

        if (!$destinataire) {
            return false;
        }

        return $this->courrier->peutEtreVuEnDetailPar($destinataire);
    }
}
