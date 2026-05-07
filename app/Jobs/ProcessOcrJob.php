<?php

namespace App\Jobs;

use App\Models\Courrier;
use App\Models\CourrierAttachment;
use App\Services\OcrService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

class ProcessOcrJob implements ShouldQueue
{
    use Dispatchable, Queueable;

    public function __construct(
        public Courrier $courrier
    ) {
    }

    public function handle(OcrService $ocrService): void
    {
        $this->courrier->update(['ocr_status' => 'processing']);

        $attachmentTexts = [];
        $allSucceeded = true;
        $hasAnyResult = false;

        $attachments = $this->courrier->attachments;

        if ($attachments->isEmpty()) {
            $this->courrier->update(['ocr_status' => 'completed']);
            return;
        }

        foreach ($attachments as $attachment) {
            $result = $this->processAttachment($ocrService, $attachment);
            $attachmentTexts[] = $result['text'];

            if ($result['success']) {
                $hasAnyResult = true;
            } else {
                $allSucceeded = false;
            }
        }

        $combinedText = $ocrService->combineAttachmentTexts($attachmentTexts);

        if ($hasAnyResult) {
            $isFirstOcr = $this->courrier->summary_source === null;

            $summarySource = $isFirstOcr
                ? 'auto_generated'
                : ($this->courrier->summary_source === 'manual' ? 'auto_generated' : $this->courrier->summary_source);

            $autoSummary = $ocrService->generateSummary($combinedText, $this->courrier->objet ?? '');

            $shouldUpdateResume = $isFirstOcr
                || empty($this->courrier->resume)
                || $this->courrier->resume === $this->courrier->objet;

            $this->courrier->update([
                'extracted_text' => $combinedText,
                'ocr_status' => $allSucceeded ? 'completed' : 'completed',
                'summary_source' => $summarySource,
                'resume' => $shouldUpdateResume ? $autoSummary : $this->courrier->resume,
            ]);
        } else {
            $this->courrier->update([
                'extracted_text' => null,
                'ocr_status' => 'failed',
            ]);
        }
    }

    private function processAttachment(OcrService $ocrService, CourrierAttachment $attachment): array
    {
        $attachment->update(['ocr_status' => 'processing']);

        try {
            $result = $ocrService->processAttachment($attachment->chemin);

            if ($result['success']) {
                $attachment->update([
                    'ocr_text' => $result['text'],
                    'ocr_language' => $result['language'],
                    'ocr_status' => 'completed',
                    'ocr_confidence' => $result['confidence'],
                    'ocr_error' => null,
                    'ocr_processed_at' => now(),
                ]);

                return ['success' => true, 'text' => $result['text']];
            }

            $attachment->update([
                'ocr_status' => 'failed',
                'ocr_error' => $result['error'],
                'ocr_processed_at' => now(),
            ]);

            Log::warning('OCR failed for attachment', [
                'attachment_id' => $attachment->id,
                'file' => $attachment->nom_original,
                'error' => $result['error'],
            ]);

            return ['success' => false, 'text' => ''];
        } catch (\Throwable $e) {
            $attachment->update([
                'ocr_status' => 'failed',
                'ocr_error' => $e->getMessage(),
                'ocr_processed_at' => now(),
            ]);

            Log::error('OCR exception for attachment', [
                'attachment_id' => $attachment->id,
                'file' => $attachment->nom_original,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return ['success' => false, 'text' => ''];
        }
    }
}
