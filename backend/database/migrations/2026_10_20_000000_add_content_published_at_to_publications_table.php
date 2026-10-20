<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Quando o rascunho foi copiado para o ar pela última vez.
 *
 * O autosave só toca o rascunho; sem esta marca o Studio não tinha como dizer
 * que uma publicação no ar tem alterações esperando o "Atualizar publicado".
 * O que já está publicado parte em dia: a marca é o `updated_at` de agora.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('publications', function (Blueprint $table): void {
            $table->timestampTz('content_published_at')->nullable()->after('status');
        });

        DB::table('publications')
            ->where('status', '!=', 'draft')
            ->update(['content_published_at' => DB::raw('now()')]);
    }

    public function down(): void
    {
        Schema::table('publications', function (Blueprint $table): void {
            $table->dropColumn('content_published_at');
        });
    }
};
