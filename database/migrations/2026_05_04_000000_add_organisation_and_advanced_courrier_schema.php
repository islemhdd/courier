<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('structures', function (Blueprint $table) {
            $table->id();
            $table->string('libelle', 120)->unique();
            $table->timestamps();
        });

        Schema::table('services', function (Blueprint $table) {
            if (!Schema::hasColumn('services', 'structure_id')) {
                $table->foreignId('structure_id')->nullable()->after('id')->constrained('structures')->nullOnDelete();
            }
        });

        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'structure_id')) {
                $table->foreignId('structure_id')->nullable()->after('service_id')->constrained('structures')->nullOnDelete();
            }

            if (!Schema::hasColumn('users', 'role_scope')) {
                $table->enum('role_scope', ['general', 'structure', 'service'])->default('service')->after('role');
            }
        });

        Schema::create('courrier_types', function (Blueprint $table) {
            $table->id();
            $table->string('libelle', 80)->unique();
            $table->timestamps();
        });

        Schema::create('sources', function (Blueprint $table) {
            $table->id();
            $table->string('libelle', 160)->unique();
            $table->timestamps();
        });

        Schema::create('instructions', function (Blueprint $table) {
            $table->id();
            $table->string('libelle', 160)->unique();
            $table->timestamps();
        });

        Schema::table('courriers', function (Blueprint $table) {
            if (!Schema::hasColumn('courriers', 'sequence_number')) {
                $table->unsignedBigInteger('sequence_number')->nullable()->after('id');
            }
            if (!Schema::hasColumn('courriers', 'courrier_type_id')) {
                $table->foreignId('courrier_type_id')->nullable()->after('type')->constrained('courrier_types')->nullOnDelete();
            }
            if (!Schema::hasColumn('courriers', 'resume')) {
                $table->text('resume')->nullable()->after('objet');
            }
            if (!Schema::hasColumn('courriers', 'source_id')) {
                $table->foreignId('source_id')->nullable()->after('expediteur')->constrained('sources')->nullOnDelete();
            }
            if (!Schema::hasColumn('courriers', 'parent_courrier_id')) {
                $table->foreignId('parent_courrier_id')->nullable()->after('source_id')->constrained('courriers')->nullOnDelete();
            }
            if (!Schema::hasColumn('courriers', 'requiert_reponse')) {
                $table->boolean('requiert_reponse')->default(false)->after('parent_courrier_id');
            }
            if (!Schema::hasColumn('courriers', 'delai_reponse_jours')) {
                $table->unsignedInteger('delai_reponse_jours')->nullable()->after('requiert_reponse');
            }
            if (!Schema::hasColumn('courriers', 'date_limite_reponse')) {
                $table->dateTime('date_limite_reponse')->nullable()->after('delai_reponse_jours');
            }
            if (!Schema::hasColumn('courriers', 'repondu_le')) {
                $table->dateTime('repondu_le')->nullable()->after('date_limite_reponse');
            }
            if (!Schema::hasColumn('courriers', 'mode_diffusion')) {
                $table->enum('mode_diffusion', ['unicast', 'multicast', 'broadcast'])->nullable()->after('repondu_le');
            }
            if (!Schema::hasColumn('courriers', 'validation_parent_id')) {
                $table->foreignId('validation_parent_id')->nullable()->after('mode_diffusion')->constrained('courriers')->nullOnDelete();
            }
        });

        Schema::create('courrier_recipients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('courrier_id')->constrained('courriers')->cascadeOnDelete();
            $table->enum('recipient_type', ['structure', 'service', 'user', 'all']);
            $table->foreignId('structure_id')->nullable()->constrained('structures')->nullOnDelete();
            $table->foreignId('service_id')->nullable()->constrained('services')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('courrier_comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('courrier_id')->constrained('courriers')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('instruction_id')->nullable()->constrained('instructions')->nullOnDelete();
            $table->text('commentaire');
            $table->boolean('validation_requise')->default(false);
            $table->foreignId('valide_par_id')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('valide_le')->nullable();
            $table->timestamps();
        });

        Schema::create('courrier_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('courrier_id')->constrained('courriers')->cascadeOnDelete();
            $table->string('nom_original', 255);
            $table->string('chemin', 255);
            $table->timestamps();
        });

        Schema::create('courrier_people', function (Blueprint $table) {
            $table->id();
            $table->foreignId('courrier_id')->constrained('courriers')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['courrier_id', 'user_id']);
        });

        if (DB::getDriverName() !== 'sqlite') {
            Schema::table('courriers', function (Blueprint $table) {
                $table->fullText('resume');
            });
        }

        $defaultStructureId = DB::table('structures')->insertGetId([
            'libelle' => 'Structure principale',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('services')
            ->whereNull('structure_id')
            ->update(['structure_id' => $defaultStructureId]);

        DB::table('users')
            ->whereNull('structure_id')
            ->update(['structure_id' => $defaultStructureId]);

        DB::table('courrier_types')->insert([
            ['libelle' => 'entrant', 'created_at' => now(), 'updated_at' => now()],
            ['libelle' => 'sortant', 'created_at' => now(), 'updated_at' => now()],
        ]);

        $counter = 1;
        DB::table('courriers')
            ->orderBy('id')
            ->get(['id', 'type', 'numero'])
            ->each(function ($courrier) use (&$counter) {
                $typeId = DB::table('courrier_types')->where('libelle', $courrier->type)->value('id');

                DB::table('courriers')
                    ->where('id', $courrier->id)
                    ->update([
                        'sequence_number' => $counter,
                        'numero' => sprintf('COUR-%06d', $counter),
                        'courrier_type_id' => $typeId,
                        'resume' => DB::table('courriers')->where('id', $courrier->id)->value('objet'),
                    ]);

                $counter++;
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('courrier_people');
        Schema::dropIfExists('courrier_attachments');
        Schema::dropIfExists('courrier_comments');
        Schema::dropIfExists('courrier_recipients');

        Schema::table('courriers', function (Blueprint $table) {
            foreach ([
                'validation_parent_id',
                'courrier_type_id',
                'source_id',
                'parent_courrier_id',
            ] as $foreign) {
                try {
                    $table->dropConstrainedForeignId($foreign);
                } catch (\Throwable $e) {
                }
            }

            foreach ([
                'sequence_number',
                'resume',
                'requiert_reponse',
                'delai_reponse_jours',
                'date_limite_reponse',
                'repondu_le',
                'mode_diffusion',
                'validation_parent_id',
            ] as $column) {
                if (Schema::hasColumn('courriers', $column)) {
                    $table->dropColumn($column);
                }
            }
        });

        Schema::table('users', function (Blueprint $table) {
            try {
                $table->dropConstrainedForeignId('structure_id');
            } catch (\Throwable $e) {
            }

            if (Schema::hasColumn('users', 'role_scope')) {
                $table->dropColumn('role_scope');
            }
        });

        Schema::table('services', function (Blueprint $table) {
            try {
                $table->dropConstrainedForeignId('structure_id');
            } catch (\Throwable $e) {
            }
        });

        Schema::dropIfExists('instructions');
        Schema::dropIfExists('sources');
        Schema::dropIfExists('courrier_types');
        Schema::dropIfExists('structures');
    }
};
