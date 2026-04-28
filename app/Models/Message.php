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
 * @property int $emetteur_id
 * @property int $destinataire_id
 * @property int|null $courrier_id
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class Message extends Model
{
    /**
     * Les attributs pouvant être assignés en masse.
     *
     * @var array<string>
     */
    protected $fillable = [
        'contenu',
        'date_envoi',
        'lu',
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
     * Mutateur : définit la date d'envoi par défaut.
     */
    public function setDateEnvoiAttribute(?string $value): void
    {
        $this->attributes['date_envoi'] = $value ?? now();
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

        // Vérifier les règles de visibilité du courrier
        $rangCourrier = $this->courrier->niveauConfidentialite?->rang ?? 0;
        $rangUser = $destinataire->getRangNiveauConfidentialite();

        // Pour l'admin, toujours accessible
        if ($destinataire->estAdmin()) {
            return true;
        }

        // Vérifier le niveau de confidentialité
        return $rangCourrier <= $rangUser;
    }
}
