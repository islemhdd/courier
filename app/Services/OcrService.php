<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Http\UploadedFile;
use Smalot\PdfParser\Parser as PdfParser;

class OcrService
{
    private const SUPPORTED_IMAGE_TYPES = ['jpg', 'jpeg', 'png', 'webp'];
    private const SUPPORTED_DOC_TYPES = ['pdf', 'doc', 'docx'];
    private const OCR_LANGUAGES = 'ara+fra+eng';

    public function extractText(UploadedFile|string $file): array
    {
        $path = $file instanceof UploadedFile ? $file->getRealPath() : $file;
        $extension = $file instanceof UploadedFile
            ? strtolower($file->getClientOriginalExtension())
            : strtolower(pathinfo($file, PATHINFO_EXTENSION));

        if (!$this->isSupported($extension)) {
            return [
                'success' => false,
                'text' => '',
                'error' => 'Type de fichier non supporté : ' . $extension . '. Types acceptés : jpg, jpeg, png, webp, pdf, doc, docx.',
            ];
        }

        try {
            if (in_array($extension, self::SUPPORTED_DOC_TYPES)) {
                return $this->extractFromDocument($path, $extension);
            }

            if (in_array($extension, self::SUPPORTED_IMAGE_TYPES)) {
                return $this->extractFromImage($path);
            }

            return [
                'success' => false,
                'text' => '',
                'error' => 'Type de fichier non supporté : ' . $extension,
            ];
        } catch (\Throwable $e) {
            Log::error('OCR extraction failed', [
                'file' => $path,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return [
                'success' => false,
                'text' => '',
                'error' => 'Erreur lors de l\'extraction du texte : ' . $e->getMessage(),
            ];
        }
    }

    public function processAttachment(string $storagePath): array
    {
        $fullPath = Storage::disk('public')->path($storagePath);
        $extension = strtolower(pathinfo($storagePath, PATHINFO_EXTENSION));

        if (!file_exists($fullPath)) {
            return [
                'success' => false,
                'text' => '',
                'language' => null,
                'confidence' => null,
                'error' => 'Fichier introuvable : ' . $storagePath,
            ];
        }

        $result = $this->extractText($fullPath);

        return [
            'success' => $result['success'],
            'text' => $result['text'] ?? '',
            'language' => $result['language'] ?? null,
            'confidence' => $result['confidence'] ?? null,
            'error' => $result['error'] ?? null,
        ];
    }

    public function generateSummary(string $text, string $objet = ''): string
    {
        $text = trim($text);
        if (empty($text)) {
            return $objet ?: '';
        }

        $text = $this->cleanText($text);

        $lines = preg_split('/\n+/', $text);
        $lines = array_map('trim', $lines);
        $lines = array_filter($lines, fn($l) => $l !== '');
        $lines = array_values($lines);

        if (empty($lines)) {
            return $objet ?: '';
        }

        $headerKeywords = ['objet', 'object', 'subject', 'réf', 'ref', 'réference', 'reference',
                            'n°', 'no.', 'numéro', 'numero', 'date', 'direction', 'service',
                            'ministère', 'destinataire', 'expéditeur', 'expediteur', 'à',
                            'cc', 'cci', 'bcc', 'pièce jointe', 'piece jointe', 'de la part',
                            'téléphone', 'telephone', 'fax', 'email', 'site'];

        $skipLines = ['bonjour', 'madame', 'monsieur', 'cher', 'chère', 'dear', 'sir', 'madam',
                       'cordialement', 'salutations', 'merci', 'sincèrement', 'respectueusement',
                       'bien à vous', 'best regards', 'sincerely', 'regards', 'thanks',
                       'veuillez agréer', 'veuillez recevoir', 'je vous prie', 'dans l\'attente',
                       'mes salutations', 'distinguées', 'distingués'];

        $candidates = [];
        foreach ($lines as $idx => $line) {
            $lower = mb_strtolower(trim($line));
            if (mb_strlen($line) < 10) continue;
            if (preg_match('/^[\d\s\/\-\.:,\;#()%]+$/', $line)) continue;

            $isHeader = false;
            foreach ($headerKeywords as $kw) {
                if (mb_strpos($lower, $kw) === 0) {
                    $isHeader = true;
                    break;
                }
            }
            if ($isHeader) continue;

            $isSkip = false;
            foreach ($skipLines as $sk) {
                if (mb_strpos($lower, $sk) === 0) {
                    $isSkip = true;
                    break;
                }
            }
            if ($isSkip) continue;

            $candidates[] = [
                'text' => $line,
                'index' => $idx,
            ];
        }

        if (empty($candidates)) {
            return $objet ?: '';
        }

        $termFreq = [];
        $totalTerms = 0;
        foreach ($candidates as $cand) {
            $words = preg_split('/[\s,;:\-–—()]+/u', $cand['text']);
            foreach ($words as $w) {
                $w = mb_strtolower(trim($w, " \t\n\r\0\x0B.,;:!?'\"-–—()«»"));
                if (mb_strlen($w) < 3) continue;
                if (preg_match('/^\d+$/', $w)) continue;
                $sw = $this->getStopWords();
                if (in_array($w, $sw)) continue;
                $termFreq[$w] = ($termFreq[$w] ?? 0) + 1;
                $totalTerms++;
            }
        }

        $maxFreq = !empty($termFreq) ? max($termFreq) : 1;
        $numCandidates = count($candidates);

        $scored = [];
        foreach ($candidates as $cand) {
            $words = preg_split('/[\s,;:\-–—()]+/u', $cand['text']);
            $score = 0;
            $wordCount = 0;

            foreach ($words as $w) {
                $w = mb_strtolower(trim($w, " \t\n\r\0\x0B.,;:!?'\"-–—()«»"));
                if (mb_strlen($w) < 3) continue;
                $sw = $this->getStopWords();
                if (in_array($w, $sw)) continue;
                $tf = ($termFreq[$w] ?? 0) / $maxFreq;
                $idf = $totalTerms > 0 ? log(1 + $totalTerms / (1 + ($termFreq[$w] ?? 1))) : 1;
                $score += $tf * $idf;
                $wordCount++;
            }

            if ($wordCount > 0) {
                $score /= sqrt($wordCount);
            }

            $positionBias = 1.0 - 0.3 * ($cand['index'] / max($numCandidates - 1, 1));
            $score *= $positionBias;

            $textLen = mb_strlen($cand['text']);
            if ($textLen > 30 && $textLen < 500) {
                $score *= 1.2;
            }

            $scored[] = [
                'text' => $cand['text'],
                'index' => $cand['index'],
                'score' => $score,
            ];
        }

        usort($scored, fn($a, $b) => $b['score'] <=> $a['score']);

        $selected = [];
        $totalSelected = min(5, $numCandidates);

        for ($i = 0; $i < count($scored) && count($selected) < $totalSelected; $i++) {
            $isDuplicate = false;
            $s1Lower = mb_strtolower($scored[$i]['text']);
            foreach ($selected as $sel) {
                $s2Lower = mb_strtolower($sel['text']);
                $shorter = mb_strlen($s1Lower) < mb_strlen($s2Lower) ? $s1Lower : $s2Lower;
                $longer = $shorter === $s1Lower ? $s2Lower : $s1Lower;
                if (mb_strlen($shorter) > 10 && mb_strpos($longer, $shorter) !== false) {
                    $isDuplicate = true;
                    break;
                }
            }
            if (!$isDuplicate) {
                $selected[] = $scored[$i];
            }
        }

        usort($selected, fn($a, $b) => $a['index'] <=> $b['index']);

        $summaryText = implode(' ', array_map(fn($s) => $s['text'], $selected));
        $summaryText = preg_replace('/\s+/', ' ', $summaryText);
        $summaryText = trim($summaryText);

        if ($objet && $summaryText) {
            $objetClean = mb_strtolower(trim($objet));
            $summaryLower = mb_strtolower($summaryText);
            if (mb_strpos($summaryLower, $objetClean) === false) {
                $first = mb_substr($summaryText, 0, 1);
                $rest = mb_substr($summaryText, 1);
                $summary = $objet . ' – ' . mb_strtolower($first) . $rest;
            } else {
                $summary = $summaryText;
            }
        } elseif ($objet) {
            $summary = $objet;
        } else {
            $summary = $summaryText;
        }

        if (mb_strlen($summary) > 600) {
            $summary = mb_substr($summary, 0, 597) . '...';
        }

        return $summary ?: $objet ?: '';
    }

    private function splitSentences(string $text): array
    {
        $text = preg_replace('/\n+/', "\n", $text);
        $text = preg_replace('/([.!?]+)\s*\n\s*/', '$1 ', $text);
        $text = preg_replace('/\n(?!\s*[A-Za-z0-9«"\'(])/', ' ', $text);

        $sentences = preg_split('/(?<=[.!?])\s+(?=[A-Za-z0-9«"\'(])/u', $text, -1, PREG_SPLIT_NO_EMPTY);

        if (count($sentences) <= 1) {
            $sentences = preg_split('/\n+/', $text);
        }

        $sentences = array_map('trim', $sentences);
        return array_values(array_filter($sentences, fn($s) => $s !== ''));
    }

    private function getStopWords(): array
    {
        return [
            'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'est', 'sont',
            'dans', 'pour', 'sur', 'avec', 'pas', 'nous', 'vous', 'leur', 'leurs',
            'qui', 'que', 'quoi', 'dont', 'ou', 'ce', 'cet', 'cette', 'ces',
            'mon', 'ton', 'son', 'ma', 'ta', 'sa', 'mes', 'tes', 'ses',
            'nos', 'vos', 'au', 'aux', 'en', 'par', 'tout', 'tous', 'toute', 'toutes',
            'chez', 'sans', 'vers', 'pendant', 'depuis', 'mais', 'si', 'ni', 'car',
            'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'have',
            'has', 'had', 'do', 'does', 'did', 'will', 'would', 'can', 'could',
            'shall', 'should', 'may', 'might', 'must', 'this', 'that', 'these',
            'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'my', 'your',
            'his', 'her', 'its', 'our', 'their', 'and', 'or', 'but', 'if', 'because',
            'so', 'than', 'as', 'until', 'while', 'of', 'at', 'by', 'for', 'with',
            'about', 'against', 'between', 'into', 'through', 'during', 'before',
            'after', 'above', 'below', 'from', 'up', 'down', 'out', 'off', 'over',
            'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when',
            'where', 'why', 'how', 'each', 'every', 'both', 'few', 'more', 'most',
            'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
            'too', 'very', 'just', 'also', 'well', 'however',
            'ceci', 'cela', 'celle', 'celui', 'celles', 'ceux',
            'même', 'mêmes', 'donc', 'enfin', 'ensuite', 'puis', 'alors',
            'also', 'well', 'very', 'just', 'even', 'still', 'already',
        ];
    }

    public function cleanText(string $text): string
    {
        $text = preg_replace('/\r\n/', "\n", $text);
        $text = preg_replace('/[ \t]+/', ' ', $text);
        $text = preg_replace('/\n{3,}/', "\n\n", $text);
        $text = preg_replace('/^\s+|\s+$/u', '', $text);

        return $text;
    }

    public function combineAttachmentTexts(array $attachmentTexts): string
    {
        $seen = [];
        $parts = [];

        foreach ($attachmentTexts as $text) {
            $normalized = preg_replace('/\s+/', ' ', trim($text));
            $hash = md5($normalized);

            if (!isset($seen[$hash]) && strlen(trim($text)) > 20) {
                $seen[$hash] = true;
                $parts[] = trim($text);
            }
        }

        return implode("\n\n---\n\n", $parts);
    }

    public function detectLanguage(string $text): string
    {
        $text = trim($text);
        if (empty($text)) {
            return 'fra';
        }

        $arabicCount = preg_match_all('/[\x{0600}-\x{06FF}\x{0750}-\x{077F}\x{08A0}-\x{08FF}\x{FB50}-\x{FDFF}\x{FE70}-\x{FEFF}]/u', $text);
        $frenchWords = preg_match_all('/\b(le|la|les|un|une|des|du|de|et|est|sont|dans|pour|sur|avec|pas|nous|vous|leur|ils|elles|qui|que|quoi|dont|ou|ce|cet|cette|ces|mon|ton|son|ma|ta|sa|mes|tes|ses|nos|vos|leurs|au|aux|en|par|tout|tous|toute|toutes|chez|sans|vers|pendant|depuis)\b/i', $text);
        $englishWords = preg_match_all('/\b(the|a|an|is|are|was|were|be|been|have|has|had|do|does|did|will|would|can|could|shall|should|may|might|must|this|that|these|those|i|you|he|she|it|we|they|my|your|his|her|its|our|their|and|or|but|if|because|so|than|as|until|while|of|at|by|for|with|about|against|between|into|through|during|before|after|above|below|from|up|down|out|off|over|under|again|further|then|once|here|there|when|where|why|how)\b/i', $text);

        if ($arabicCount > 10 && $arabicCount > max($frenchWords, $englishWords)) {
            return 'ara';
        }

        if ($frenchWords > $englishWords) {
            return 'fra';
        }

        if ($englishWords > $frenchWords) {
            return 'eng';
        }

        return 'fra';
    }

    public function isSupported(string $extension): bool
    {
        return in_array(
            strtolower($extension),
            array_merge(self::SUPPORTED_IMAGE_TYPES, self::SUPPORTED_DOC_TYPES)
        );
    }

    private function extractFromDocument(string $path, string $extension): array
    {
        if ($extension === 'pdf') {
            return $this->extractFromPdf($path);
        }

        if (in_array($extension, ['doc', 'docx'])) {
            return $this->extractFromDoc($path);
        }

        return ['success' => false, 'text' => '', 'error' => 'Format document non supporté.'];
    }

    private function extractFromPdf(string $path): array
    {
        try {
            if (!class_exists(PdfParser::class)) {
                throw new \RuntimeException('smalot/pdfparser n\'est pas installé. Exécutez : composer require smalot/pdfparser');
            }

            $parser = new PdfParser();
            $pdf = $parser->parseFile($path);
            $text = $pdf->getText();
            $text = $this->cleanText($text);

            if (strlen(trim($text)) > 50) {
                $language = $this->detectLanguage($text);

                return [
                    'success' => true,
                    'text' => $text,
                    'language' => $language,
                    'confidence' => 100.00,
                    'error' => null,
                ];
            }

            return $this->ocrImage($path);
        } catch (\Throwable $e) {
            return $this->ocrImage($path);
        }
    }

    private function extractFromDoc(string $path): array
    {
        try {
            $text = '';
            $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));

            if ($extension === 'docx') {
                $zip = new \ZipArchive();
                if ($zip->open($path) === true) {
                    $content = $zip->getFromName('word/document.xml');
                    $zip->close();
                    if ($content !== false) {
                        $xml = simplexml_load_string($content);
                        if ($xml !== false) {
                            $namespaces = $xml->getNamespaces(true);
                            $body = $xml->xpath('//w:body');
                            if ($body && !empty($body)) {
                                $textParts = [];
                                foreach ($body[0]->xpath('.//w:t') as $t) {
                                    $textParts[] = (string)$t;
                                }
                                $text = implode(' ', $textParts);
                            }
                        }
                    }
                }
            }

            if (strlen(trim($text)) < 20) {
                return $this->ocrImage($path);
            }

            $text = $this->cleanText($text);
            $language = $this->detectLanguage($text);

            return [
                'success' => true,
                'text' => $text,
                'language' => $language,
                'confidence' => 100.00,
                'error' => null,
            ];
        } catch (\Throwable $e) {
            return [
                'success' => false,
                'text' => '',
                'error' => 'Impossible de lire le document Word : ' . $e->getMessage(),
            ];
        }
    }

    private function extractFromImage(string $path): array
    {
        return $this->ocrImage($path);
    }

    private function ocrImage(string $path): array
    {
        $tesseractPath = $this->findTesseract();

        if ($tesseractPath === null) {
            return [
                'success' => false,
                'text' => '',
                'language' => null,
                'confidence' => null,
                'error' => 'Tesseract OCR n\'est pas installé sur le système. '
                    . 'Pour installer : https://github.com/tesseract-ocr/tesseract '
                    . 'Paquets requis : tesseract-ocr, tesseract-ocr-ara, tesseract-ocr-fra, tesseract-ocr-eng',
            ];
        }

        $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));

        if ($extension === 'pdf') {
            $imagePaths = $this->convertPdfToImages($path);
            if (empty($imagePaths)) {
                return [
                    'success' => false,
                    'text' => '',
                    'language' => null,
                    'confidence' => null,
                    'error' => 'Impossible de convertir le PDF en images pour OCR. '
                        . 'Installez Ghostscript (gs) ou Imagick PHP.',
                ];
            }
        } else {
            $imagePaths = [$path];
        }

        $allText = '';
        $totalConfidence = 0;
        $imageCount = 0;

        foreach ($imagePaths as $imagePath) {
            $result = $this->runTesseract($tesseractPath, $imagePath);
            if ($result !== null) {
                $allText .= $result['text'] . "\n\n";
                $totalConfidence += $result['confidence'];
                $imageCount++;
            }

            if ($imagePath !== $path && file_exists($imagePath)) {
                @unlink($imagePath);
            }
        }

        $allText = $this->cleanText($allText);

        if (empty(trim($allText))) {
            return [
                'success' => false,
                'text' => '',
                'language' => null,
                'confidence' => null,
                'error' => 'L\'OCR n\'a pas pu extraire de texte de ce fichier.',
            ];
        }

        $language = $this->detectLanguage($allText);
        $avgConfidence = $imageCount > 0 ? round($totalConfidence / $imageCount, 2) : null;

        return [
            'success' => true,
            'text' => $allText,
            'language' => $language,
            'confidence' => min($avgConfidence, 100.00),
            'error' => null,
        ];
    }

    private function runTesseract(string $tesseractPath, string $imagePath): ?array
    {
        $escapedImage = escapeshellarg($imagePath);
        $lang = self::OCR_LANGUAGES;
        $outputDir = dirname($imagePath) . DIRECTORY_SEPARATOR . 'ocr_' . uniqid();
        $escapedOutput = escapeshellarg($outputDir);

        $cmd = "\"{$tesseractPath}\" {$escapedImage} {$escapedOutput} -l {$lang} --psm 3 2>&1";

        exec($cmd, $outputLines, $exitCode);

        $textFile = $outputDir . '.txt';
        $text = '';

        if (file_exists($textFile)) {
            $text = file_get_contents($textFile);
            @unlink($textFile);
        }

        if ($exitCode !== 0) {
            return null;
        }

        $confidence = $this->estimateConfidence($text);

        return [
            'text' => $text,
            'confidence' => $confidence,
        ];
    }

    private function findTesseract(): ?string
    {
        $possiblePaths = [
            'tesseract',
            'tesseract.exe',
            'C:\\Program Files\\Tesseract-OCR\\tesseract.exe',
            'C:\\Program Files (x86)\\Tesseract-OCR\\tesseract.exe',
        ];

        foreach ($possiblePaths as $path) {
            $escapedPath = escapeshellarg($path);
            $cmd = "\"{$path}\" --version 2>&1";
            exec($cmd, $output, $exitCode);
            if ($exitCode === 0) {
                return $path;
            }
        }

        if (DIRECTORY_SEPARATOR === '/') {
            exec('which tesseract 2>&1', $whichOutput, $whichExitCode);
            if ($whichExitCode === 0 && !empty($whichOutput[0])) {
                return trim($whichOutput[0]);
            }

            $nixPaths = ['/usr/bin/tesseract', '/usr/local/bin/tesseract', '/opt/homebrew/bin/tesseract'];
            foreach ($nixPaths as $path) {
                if (file_exists($path)) {
                    return $path;
                }
            }
        }

        $potentialDirs = [
            'C:\\Program Files\\Tesseract-OCR',
            'C:\\Program Files (x86)\\Tesseract-OCR',
            getenv('TESSERACT_HOME'),
        ];

        foreach ($potentialDirs as $dir) {
            if ($dir) {
                $exe = $dir . DIRECTORY_SEPARATOR . 'tesseract.exe';
                if (file_exists($exe)) {
                    return $exe;
                }
            }
        }

        return null;
    }

    private function convertPdfToImages(string $pdfPath): array
    {
        $outputDir = dirname($pdfPath) . DIRECTORY_SEPARATOR . 'pdf_images_' . uniqid();
        @mkdir($outputDir, 0755, true);

        if (extension_loaded('imagick')) {
            try {
                $imagick = new \Imagick();
                $imagick->setResolution(200, 200);
                $imagick->readImage($pdfPath);
                $imagick->setIteratorIndex(0);

                $paths = [];
                $pageNum = 1;

                foreach ($imagick as $page) {
                    $page->setImageFormat('png');
                    $page->setImageCompressionQuality(90);
                    $imagePath = $outputDir . DIRECTORY_SEPARATOR . 'page_' . $pageNum . '.png';
                    $page->writeImage($imagePath);
                    $paths[] = $imagePath;
                    $pageNum++;
                }

                $imagick->clear();

                return $paths;
            } catch (\Throwable $e) {
                Log::warning('Imagick PDF conversion failed, trying Ghostscript', [
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return $this->convertPdfWithGhostscript($pdfPath, $outputDir);
    }

    private function convertPdfWithGhostscript(string $pdfPath, string $outputDir): array
    {
        $gsPath = $this->findGhostscript();

        if ($gsPath === null) {
            return [];
        }

        $escapedPdf = escapeshellarg($pdfPath);
        $escapedOutput = escapeshellarg($outputDir . DIRECTORY_SEPARATOR . 'page_%d.png');
        $cmd = "\"{$gsPath}\" -dNOPAUSE -dBATCH -sDEVICE=png16m -r200 -o {$escapedOutput} {$escapedPdf} 2>&1";

        exec($cmd, $outputLines, $exitCode);

        if ($exitCode !== 0) {
            return [];
        }

        $paths = glob($outputDir . DIRECTORY_SEPARATOR . 'page_*.png');
        sort($paths);

        return $paths;
    }

    private function findGhostscript(): ?string
    {
        $possiblePaths = [
            'gs',
            'gswin64c',
            'gswin32c',
            'C:\\Program Files\\gs\\gs*\\bin\\gswin64c.exe',
        ];

        foreach ($possiblePaths as $path) {
            if (str_contains($path, '*')) {
                $globbed = glob($path);
                if (!empty($globbed)) {
                    return $globbed[0];
                }
                continue;
            }

            exec("\"{$path}\" --version 2>&1", $output, $exitCode);
            if ($exitCode === 0) {
                return $path;
            }
        }

        if (strtoupper(substr(PHP_OS, 0, 3)) !== 'WIN') {
            exec('which gs 2>&1', $whichOutput, $whichExitCode);
            if ($whichExitCode === 0 && !empty($whichOutput[0])) {
                return trim($whichOutput[0]);
            }
        }

        return null;
    }

    private function estimateConfidence(string $text): float
    {
        $text = trim($text);
        if (empty($text)) {
            return 0;
        }

        $totalChars = mb_strlen($text);
        if ($totalChars === 0) {
            return 0;
        }

        $alphaCount = preg_match_all('/[a-zA-Z\x{0600}-\x{06FF}]/u', $text);
        $alphaRatio = $alphaCount / $totalChars;

        $wordLengths = [];
        preg_match_all('/\S+/', $text, $words);
        foreach ($words[0] as $word) {
            $wordLengths[] = mb_strlen($word);
        }

        $avgWordLength = !empty($wordLengths) ? array_sum($wordLengths) / count($wordLengths) : 0;

        $confidence = 50.0;

        if ($alphaRatio > 0.5) {
            $confidence += 20;
        }
        if ($alphaRatio > 0.7) {
            $confidence += 15;
        }

        if ($avgWordLength > 2 && $avgWordLength < 20) {
            $confidence += 10;
        }

        if ($totalChars > 50) {
            $confidence += 5;
        }

        return min($confidence, 100.0);
    }

    private function extractKeyInformation(string $text): array
    {
        $info = [
            'references' => [],
            'dates' => [],
            'organizations' => [],
            'persons' => [],
        ];

        preg_match_all('/\b\d{2,4}[-\\/]\d{2}[-\\/]\d{2,4}\b/', $text, $dateMatches);
        $info['dates'] = array_unique($dateMatches[0]);

        preg_match_all('/\b(?:N[°]?|n°|No\.?|num[eé]ro|#)\s*\d+[\w\/-]*\b/i', $text, $refMatches);
        $info['references'] = array_unique($refMatches[0]);

        preg_match_all('/\b(?:COUR-\d{6}|COUR-\d{4}-\d{4})\b/', $text, $courrierMatches);
        $info['references'] = array_unique(array_merge($info['references'], $courrierMatches[0]));

        $orgPatterns = [
            '/\b(?:Minist[èe]re|Direction|Service|Division|Bureau|Cellule|D[ée]partement|Unit[ée]|Agence|Office|Soci[ée]t[ée]|Entreprise|Administration|Pr[ée]fecture|Wilaya|Commune|Mairie|H[ôo]pital|Centre|Institut|[Ée]cole|Universit[ée]|Laboratoire)\s+[\w\s\'\-&]+/i',
            '/\b[\w\s\'\-&]+\s+(?:SARL|SPA|EURL|SNC|SCS|SCA)\b/i',
        ];

        foreach ($orgPatterns as $pattern) {
            preg_match_all($pattern, $text, $orgMatches);
            foreach ($orgMatches[0] as $match) {
                $match = trim($match);
                if (strlen($match) > 5) {
                    $info['organizations'][] = $match;
                }
            }
        }
        $info['organizations'] = array_unique($info['organizations']);

        $personPattern = '/\b[A-Z][a-zàâçéèêëîïôûùüÿñæœ]+(?:\s+[A-Z][a-zàâçéèêëîïôûùüÿñæœ]+){1,3}\b/u';
        preg_match_all($personPattern, $text, $personMatches);
        $stopWords = ['Objet', 'Réf', 'Reference', 'N°', 'Numéro', 'Date', 'Madame', 'Monsieur', 'Bonjour', 'Cordialement', 'Merci', 'Sujet', 'The', 'This', 'These', 'Those', 'Dear', 'Hello'];
        $filteredPersons = [];
        foreach ($personMatches[0] as $person) {
            if (!in_array($person, $stopWords) && strlen($person) > 5 && !preg_match('/^\d/', $person)) {
                $filteredPersons[] = $person;
            }
        }
        $info['persons'] = array_unique(array_slice($filteredPersons, 0, 10));

        return $info;
    }
}
