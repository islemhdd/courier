<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'sqlite') {
            try {
                DB::statement('ALTER TABLE courriers ADD FULLTEXT INDEX courriers_search_fulltext (numero, objet, resume, expediteur, destinataire)');
            } catch (\Throwable $e) {
                // Index may already exist
            }
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'sqlite') {
            try {
                Schema::table('courriers', function (Blueprint $table) {
                    $table->dropIndex('courriers_search_fulltext');
                });
            } catch (\Throwable $e) {
                // Index may not exist
            }
        }
    }
};
