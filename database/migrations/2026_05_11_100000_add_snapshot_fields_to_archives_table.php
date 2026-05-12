<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('archives', function (Blueprint $table) {
            if (!Schema::hasColumn('archives', 'courrier_type_id')) {
                $table->foreignId('courrier_type_id')->nullable()->after('type')->constrained('courrier_types')->nullOnDelete();
            }

            if (!Schema::hasColumn('archives', 'resume')) {
                $table->text('resume')->nullable()->after('courrier_type_id');
            }

            if (!Schema::hasColumn('archives', 'extracted_text')) {
                $table->longText('extracted_text')->nullable()->after('resume');
            }

            if (!Schema::hasColumn('archives', 'ocr_status')) {
                $table->string('ocr_status', 20)->nullable()->after('extracted_text');
            }

            if (!Schema::hasColumn('archives', 'summary_source')) {
                $table->string('summary_source', 20)->nullable()->after('ocr_status');
            }

            if (!Schema::hasColumn('archives', 'date_limite_reponse')) {
                $table->dateTime('date_limite_reponse')->nullable()->after('date_reception');
            }

            if (!Schema::hasColumn('archives', 'repondu_le')) {
                $table->dateTime('repondu_le')->nullable()->after('date_limite_reponse');
            }

            if (!Schema::hasColumn('archives', 'source_id')) {
                $table->foreignId('source_id')->nullable()->after('destinataire')->constrained('sources')->nullOnDelete();
            }

            if (!Schema::hasColumn('archives', 'structure_origine_id')) {
                $table->foreignId('structure_origine_id')->nullable()->after('service_destinataire_id')->constrained('structures')->nullOnDelete();
            }

            if (!Schema::hasColumn('archives', 'structure_destinataire_id')) {
                $table->foreignId('structure_destinataire_id')->nullable()->after('structure_origine_id')->constrained('structures')->nullOnDelete();
            }

            if (!Schema::hasColumn('archives', 'attachments_snapshot')) {
                $table->json('attachments_snapshot')->nullable()->after('motif');
            }

            if (!Schema::hasColumn('archives', 'comments_snapshot')) {
                $table->json('comments_snapshot')->nullable()->after('attachments_snapshot');
            }
        });
    }

    public function down(): void
    {
        Schema::table('archives', function (Blueprint $table) {
            foreach (['structure_destinataire_id', 'structure_origine_id', 'source_id', 'courrier_type_id'] as $column) {
                if (Schema::hasColumn('archives', $column)) {
                    $table->dropConstrainedForeignId($column);
                }
            }

            $columns = [
                'comments_snapshot',
                'attachments_snapshot',
                'repondu_le',
                'date_limite_reponse',
                'summary_source',
                'ocr_status',
                'extracted_text',
                'resume',
            ];

            foreach ($columns as $column) {
                if (Schema::hasColumn('archives', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
