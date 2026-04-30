<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'mysql') {
            return;
        }

        DB::statement("
            ALTER TABLE courriers
            MODIFY statut ENUM('CREE', 'NON_VALIDE', 'VALIDE', 'TRANSMIS', 'RECU')
            NOT NULL DEFAULT 'CREE'
        ");
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'mysql') {
            return;
        }

        DB::statement("UPDATE courriers SET statut = 'CREE' WHERE statut = 'NON_VALIDE'");

        DB::statement("
            ALTER TABLE courriers
            MODIFY statut ENUM('CREE', 'VALIDE', 'TRANSMIS', 'RECU')
            NOT NULL DEFAULT 'CREE'
        ");
    }
};
