<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('courrier_attachments', function (Blueprint $table) {
            $table->longText('ocr_text')->nullable()->after('chemin');
            $table->string('ocr_language', 50)->nullable()->after('ocr_text');
            $table->string('ocr_status', 20)->default('pending')->after('ocr_language');
            $table->decimal('ocr_confidence', 5, 2)->nullable()->after('ocr_status');
            $table->text('ocr_error')->nullable()->after('ocr_confidence');
            $table->dateTime('ocr_processed_at')->nullable()->after('ocr_error');
        });
    }

    public function down(): void
    {
        Schema::table('courrier_attachments', function (Blueprint $table) {
            $table->dropColumn([
                'ocr_text',
                'ocr_language',
                'ocr_status',
                'ocr_confidence',
                'ocr_error',
                'ocr_processed_at',
            ]);
        });
    }
};
