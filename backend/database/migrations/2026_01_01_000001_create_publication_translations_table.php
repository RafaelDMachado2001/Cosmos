<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * O conteúdo, uma linha por idioma.
 *
 * O `search_vector` é uma coluna gerada, não um gatilho: o Postgres a mantém em
 * dia sozinho, e não há caminho pelo qual um texto entre sem ser indexado —
 * inclusive pelo painel administrativo, que escreve pelo Eloquent.
 *
 * O dicionário sai do próprio `locale` da linha. É o que faz "índices" encontrar
 * "indexação" em português e "indexing" encontrar "index" em inglês, com a
 * mesma coluna.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('publication_translations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('publication_id')->constrained()->cascadeOnDelete();
            $table->string('locale', 5);
            $table->string('title');
            $table->text('summary');
            $table->text('body');
            $table->timestampsTz();

            $table->unique(['publication_id', 'locale']);
        });

        $dictionary = "CASE WHEN locale = 'pt' THEN 'portuguese'::regconfig ELSE 'english'::regconfig END";

        DB::statement(<<<SQL
            ALTER TABLE publication_translations
              ADD COLUMN search_vector tsvector
              GENERATED ALWAYS AS (
                setweight(to_tsvector({$dictionary}, coalesce(title, '')), 'A') ||
                setweight(to_tsvector({$dictionary}, coalesce(summary, '')), 'B') ||
                setweight(to_tsvector({$dictionary}, coalesce(body, '')), 'C')
              ) STORED
            SQL);

        DB::statement('CREATE INDEX publication_translations_search_vector_index ON publication_translations USING GIN (search_vector)');
    }

    public function down(): void
    {
        Schema::dropIfExists('publication_translations');
    }
};
