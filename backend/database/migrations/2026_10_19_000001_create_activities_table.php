<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * O registro das ações de domínio dos leitores, append-only (módulo Activity).
 *
 * É a história de que a gamificação vai ser uma projeção: pontos por coisas
 * feitas antes de ela existir. Só ações de domínio — nem login nem leitura,
 * que seriam dado pessoal sem uso.
 *
 * O gatilho recusa UPDATE e DELETE no banco, não só no modelo. A exceção é a
 * anonimização (DELETE /api/me): com `cosmos.anonymizing` ligado na
 * transação, um UPDATE pode reescrever o `payload` e nada mais.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('activities', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('member_id')->constrained()->restrictOnDelete();
            $table->string('verb', 60);
            // Um apelido estável ('member', 'publication'), nunca o nome da
            // classe: mover um modelo não pode reescrever a história.
            $table->string('subject_type', 40)->nullable();
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->jsonb('payload')->default('{}');
            $table->timestampTz('occurred_at')->useCurrent();

            $table->index(['member_id', 'occurred_at']);
            $table->index(['verb', 'occurred_at']);
        });

        DB::unprepared(<<<'SQL'
            -- O migrate:fresh apaga as tabelas, não as funções: daí o OR REPLACE.
            CREATE OR REPLACE FUNCTION activities_append_only() RETURNS trigger AS $$
            BEGIN
                IF TG_OP = 'UPDATE'
                    AND current_setting('cosmos.anonymizing', true) = 'on'
                    AND NEW.id = OLD.id
                    AND NEW.member_id = OLD.member_id
                    AND NEW.verb = OLD.verb
                    AND NEW.subject_type IS NOT DISTINCT FROM OLD.subject_type
                    AND NEW.subject_id IS NOT DISTINCT FROM OLD.subject_id
                    AND NEW.occurred_at = OLD.occurred_at
                THEN
                    RETURN NEW;
                END IF;

                RAISE EXCEPTION 'activities é append-only: % recusado', TG_OP;
            END
            $$ LANGUAGE plpgsql;

            CREATE TRIGGER activities_append_only
                BEFORE UPDATE OR DELETE ON activities
                FOR EACH ROW EXECUTE FUNCTION activities_append_only();
            SQL);
    }

    public function down(): void
    {
        Schema::dropIfExists('activities');
        DB::unprepared('DROP FUNCTION IF EXISTS activities_append_only()');
    }
};
