<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessOcrJob;
use App\Models\Courrier;
use App\Services\OcrService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OcrController extends Controller
{
    public function __construct(
        private OcrService $ocrService
    ) {
    }

    public function preview(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:jpg,jpeg,png,pdf,doc,docx,webp', 'max:10240'],
        ]);

        $file = $request->file('file');

        if (!$this->ocrService->isSupported($file->getClientOriginalExtension())) {
            return response()->json([
                'success' => false,
                'error' => 'Type de fichier non supporté : ' . $file->getClientOriginalExtension(),
            ], 422);
        }

        $result = $this->ocrService->extractText($file);

        if (!$result['success']) {
            return response()->json([
                'success' => false,
                'error' => $result['error'] ?? 'Impossible d\'extraire le texte.',
            ], 422);
        }

        $summary = $this->ocrService->generateSummary($result['text']);

        return response()->json([
            'success' => true,
            'text' => $result['text'],
            'summary' => $summary,
            'language' => $result['language'] ?? null,
            'confidence' => $result['confidence'] ?? null,
        ]);
    }

    public function status(Courrier $courrier, Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$courrier->peutVoirExistencePar($user)) {
            return response()->json(['error' => 'Accès refusé.'], 403);
        }

        $courrier->load('attachments');

        return response()->json([
            'ocr_status' => $courrier->ocr_status,
            'summary_source' => $courrier->summary_source,
            'extracted_text' => $courrier->peutEtreVuEnDetailPar($user)
                ? $courrier->extracted_text
                : null,
            'attachments' => $courrier->attachments->map(function ($att) use ($user) {
                return [
                    'id' => $att->id,
                    'nom_original' => $att->nom_original,
                    'ocr_status' => $att->ocr_status,
                    'ocr_language' => $att->ocr_language,
                    'ocr_confidence' => $att->ocr_confidence,
                    'ocr_error' => $att->ocr_error,
                    'ocr_processed_at' => $att->ocr_processed_at,
                    'ocr_text' => $courrier->peutEtreVuEnDetailPar($user)
                        ? $att->ocr_text
                        : null,
                ];
            }),
        ]);
    }

    public function rerun(Courrier $courrier, Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$courrier->peutEtreVuEnDetailPar($user)) {
            return response()->json(['error' => 'Accès refusé.'], 403);
        }

        $courrier->attachments()->each(function ($attachment) {
            $attachment->updateQuietly([
                'ocr_status' => 'pending',
                'ocr_text' => null,
                'ocr_language' => null,
                'ocr_confidence' => null,
                'ocr_error' => null,
                'ocr_processed_at' => null,
            ]);
        });

        $courrier->updateQuietly([
            'ocr_status' => 'pending',
            'extracted_text' => null,
        ]);

        ProcessOcrJob::dispatch($courrier);

        return response()->json([
            'message' => 'OCR relancé avec succès.',
            'ocr_status' => 'pending',
        ]);
    }
}
