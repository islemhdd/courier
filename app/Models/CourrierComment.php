<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CourrierComment extends Model
{
    protected $fillable = [
        'courrier_id',
        'user_id',
        'instruction_id',
        'commentaire',
        'validation_requise',
        'valide_par_id',
        'valide_le',
    ];

    protected $casts = [
        'validation_requise' => 'boolean',
        'valide_le' => 'datetime',
    ];

    public function courrier(): BelongsTo
    {
        return $this->belongsTo(Courrier::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function instruction(): BelongsTo
    {
        return $this->belongsTo(Instruction::class);
    }

    public function validePar(): BelongsTo
    {
        return $this->belongsTo(User::class, 'valide_par_id');
    }
}
