<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        DB::statement("
            ALTER TABLE archives
            MODIFY statut_original ENUM('CREE', 'NON_VALIDE', 'VALIDE', 'TRANSMIS', 'RECU')
        ");
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        DB::statement("
            ALTER TABLE archives
            MODIFY statut_original ENUM('VALIDE', 'TRANSMIS', 'RECU')
        ");
    }
};
