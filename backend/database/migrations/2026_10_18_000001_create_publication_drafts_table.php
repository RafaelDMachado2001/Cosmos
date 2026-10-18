<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * O conteúdo de trabalho, separado do publicado.
 *
 * Mesmo formato de chave que `publication_translations` (uma linha por
 * publicação por idioma), mas os blocos ficam em JSON — é o editor em blocos
 * do RDM Studio que lê e escreve aqui, nunca o público. Publicar copia daqui
 * para `publication_translations`, serializando os blocos para o mesmo
 * subconjunto de Markdown que `core/blocks.ts` já interpreta (nunca HTML).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('publication_drafts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('publication_id')->constrained()->cascadeOnDelete();
            $table->string('locale', 5);
            $table->string('title')->nullable();
            $table->string('subtitle')->nullable();
            $table->jsonb('blocks')->default('[]');
            $table->string('seo_title')->nullable();
            $table->string('seo_description')->nullable();
            $table->timestampsTz();

            $table->unique(['publication_id', 'locale']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('publication_drafts');
    }
};
