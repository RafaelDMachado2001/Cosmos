<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lista numerada, compartilhada entre PT e EN (igual às tags): a referência é
 * sobre a fonte, não sobre a tradução.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('publication_references', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('publication_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('position');
            $table->string('title');
            $table->string('url');
            $table->timestampsTz();

            $table->unique(['publication_id', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('publication_references');
    }
};
