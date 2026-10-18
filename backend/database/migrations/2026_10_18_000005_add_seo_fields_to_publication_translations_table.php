<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * O override de SEO do RDM Studio, por tradução. Nulo por padrão: a API e
 * `core/seo.ts` caem para `title`/`summary` quando não há override — nunca
 * uma segunda cópia do título obrigatória.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('publication_translations', function (Blueprint $table): void {
            $table->string('seo_title')->nullable()->after('body');
            $table->string('seo_description')->nullable()->after('seo_title');
        });
    }

    public function down(): void
    {
        Schema::table('publication_translations', function (Blueprint $table): void {
            $table->dropColumn(['seo_title', 'seo_description']);
        });
    }
};
