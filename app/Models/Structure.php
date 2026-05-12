<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Structure extends Model
{
    protected $fillable = [
        'libelle',
        'description',
        'chef_structure_id',
    ];

    public function chefStructure(): BelongsTo
    {
        return $this->belongsTo(User::class, 'chef_structure_id');
    }

    public function chef(): HasOne
    {
        return $this->hasOne(User::class, 'structure_id')
            ->where('role', User::ROLE_CHEF)
            ->where('role_scope', User::SCOPE_STRUCTURE);
    }

    public function services(): HasMany
    {
        return $this->hasMany(Service::class);
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function courriersOrigine(): HasMany
    {
        return $this->hasMany(Courrier::class, 'structure_origine_id');
    }

    public function courriersDestinataires(): HasMany
    {
        return $this->hasMany(Courrier::class, 'structure_destinataire_id');
    }

    public function courrierRecipients(): HasMany
    {
        return $this->hasMany(CourrierRecipient::class);
    }
}
