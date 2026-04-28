<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class NiveauConfidentialite extends Model
{
    /**
     * Les attributs pouvant être assignés en masse.
     *
     * @var array<string>
     */
    protected $fillable = [
        'libelle',
        'rang',
    ];

    /**
     * Les attributs qui doivent être convertis.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'rang' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Relation : un niveau de confidentialité peut avoir plusieurs utilisateurs.
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    /**
     * Relation : un niveau de confidentialité peut avoir plusieurs courriers.
     */
    public function courriers(): HasMany
    {
        return $this->hasMany(Courrier::class);
    }

    /**
     * Vérifie si ce niveau est inférieur ou égal à un autre niveau.
     */
    public function estInferieurOuEgal(NiveauConfidentialite $autre): bool
    {
        return $this->rang <= $autre->rang;
    }
}
