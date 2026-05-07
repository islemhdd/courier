<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('courriers', function (Blueprint $table) {
            $table->longText('extracted_text')->nullable()->after('resume');
            $table->string('ocr_status', 20)->default('pending')->after('extracted_text');
            $table->string('summary_source', 20)->default('manual')->after('ocr_status');
        });
    }

    public function down(): void
    {
        Schema::table('courriers', function (Blueprint $table) {
            $table->dropColumn(['extracted_text', 'ocr_status', 'summary_source']);
        });
    }
};
