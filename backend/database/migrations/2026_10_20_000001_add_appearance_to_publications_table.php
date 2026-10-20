<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A aparência da tela de leitura (`{ nebula, motion }`, `core/appearance.ts`).
 * Nula é "herdar da categoria": o padrão global, sem nada gravado.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('publications', function (Blueprint $table): void {
            $table->jsonb('appearance')->nullable()->after('indexable');
        });
    }

    public function down(): void
    {
        Schema::table('publications', function (Blueprint $table): void {
            $table->dropColumn('appearance');
        });
    }
};
