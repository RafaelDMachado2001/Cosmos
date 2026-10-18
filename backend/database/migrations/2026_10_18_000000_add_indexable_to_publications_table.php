<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * `status` já é `string` livre — "scheduled" não pede coluna nova, só o valor
 * novo na constante `Publication::STATUS_SCHEDULED` e na validação do painel.
 *
 * `indexable` é o único campo de fato novo: desligado, a publicação sai do
 * sitemap e ganha `noindex` (RDM Studio, seção SEO).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('publications', function (Blueprint $table): void {
            $table->boolean('indexable')->default(true)->after('featured');
        });
    }

    public function down(): void
    {
        Schema::table('publications', function (Blueprint $table): void {
            $table->dropColumn('indexable');
        });
    }
};
