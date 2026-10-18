<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Uma linha por imagem enviada pelo RDM Studio.
 *
 * `width`/`height` gravados no upload (não lidos de novo a cada leitura): é o
 * que permite a página pública reservar o espaço certo e evitar layout shift.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('media', function (Blueprint $table): void {
            $table->id();
            $table->string('path');
            $table->unsignedInteger('width');
            $table->unsignedInteger('height');
            $table->string('mime');
            $table->string('alt_default')->nullable();
            $table->timestampsTz();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('media');
    }
};
