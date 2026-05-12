<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Service extends Model
{
    protected $fillable = [
        'libelle',
        'description',
        'structure_id',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function structure(): BelongsTo
    {
        return $this->belongsTo(Structure::class);
    }

    public function chef(): HasOne
    {
        return $this->hasOne(User::class, 'service_id')
            ->where('role', User::ROLE_CHEF)
            ->where('role_scope', User::SCOPE_SERVICE);
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function courriers(): HasMany
    {
        return $this->courriersSource();
    }

    public function courriersSource(): HasMany
    {
        return $this->hasMany(Courrier::class, 'service_source_id');
    }

    public function courriersDestinataires(): HasMany
    {
        return $this->hasMany(Courrier::class, 'service_destinataire_id');
    }

    public function courrierRecipients(): HasMany
    {
        return $this->hasMany(CourrierRecipient::class);
    }

    public function archivesSource(): HasMany
    {
        return $this->hasMany(Archive::class, 'service_source_id');
    }

    public function archivesDestinataires(): HasMany
    {
        return $this->hasMany(Archive::class, 'service_destinataire_id');
    }
}
