<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * As publicações.
 *
 * Nenhuma coordenada é guardada aqui: a posição de cada estrela é derivada da
 * data e de um hash FNV-1a do slug, no cliente. É o que garante que publicar um
 * item novo não mova os que já existem — ver src/core/timeline.ts.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('publications', function (Blueprint $table): void {
            $table->id();
            $table->string('slug')->unique();
            $table->string('category');
            $table->timestampTz('published_at');
            $table->boolean('featured')->default(false);
            $table->string('status')->default('draft');
            $table->timestampsTz();
        });

        // A constelação lê sempre do mais novo para o mais antigo: o índice
        // precisa da mesma ordem, senão o planejador ordena em memória.
        DB::statement('CREATE INDEX publications_published_at_desc_index ON publications (published_at DESC)');
        DB::statement('CREATE INDEX publications_category_published_at_index ON publications (category, published_at DESC)');
    }

    public function down(): void
    {
        Schema::dropIfExists('publications');
    }
};
