<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CourrierAttachment extends Model
{
    protected $fillable = [
        'courrier_id',
        'nom_original',
        'chemin',
        'ocr_text',
        'ocr_language',
        'ocr_status',
        'ocr_confidence',
        'ocr_error',
        'ocr_processed_at',
    ];

    protected $casts = [
        'ocr_confidence' => 'decimal:2',
        'ocr_processed_at' => 'datetime',
    ];

    public function courrier(): BelongsTo
    {
        return $this->belongsTo(Courrier::class);
    }

    public function ocrEstTermine(): bool
    {
        return $this->ocr_status === 'completed';
    }

    public function ocrAEchoue(): bool
    {
        return $this->ocr_status === 'failed';
    }

    public function ocrEstEnCours(): bool
    {
        return $this->ocr_status === 'processing';
    }

    public function ocrEstEnAttente(): bool
    {
        return $this->ocr_status === 'pending';
    }
}
