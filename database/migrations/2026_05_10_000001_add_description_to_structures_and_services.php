<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('structures', function (Blueprint $table) {
            if (!Schema::hasColumn('structures', 'description')) {
                $table->text('description')->nullable()->after('libelle');
            }
        });

        Schema::table('services', function (Blueprint $table) {
            if (!Schema::hasColumn('services', 'description')) {
                $table->text('description')->nullable()->after('libelle');
            }
        });
    }

    public function down(): void
    {
        Schema::table('structures', function (Blueprint $table) {
            if (Schema::hasColumn('structures', 'description')) {
                $table->dropColumn('description');
            }
        });

        Schema::table('services', function (Blueprint $table) {
            if (Schema::hasColumn('services', 'description')) {
                $table->dropColumn('description');
            }
        });
    }
};
