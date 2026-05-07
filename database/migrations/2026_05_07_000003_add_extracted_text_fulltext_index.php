<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'sqlite') {
            try {
                DB::statement('ALTER TABLE courriers ADD FULLTEXT INDEX courriers_extracted_text_fulltext (extracted_text)');
            } catch (\Throwable $e) {
                // Index may already exist
            }
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'sqlite') {
            try {
                DB::statement('ALTER TABLE courriers DROP INDEX courriers_extracted_text_fulltext');
            } catch (\Throwable $e) {
                // Index may not exist
            }
        }
    }
};
