<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Compartilhadas entre PT e EN — a tag é sobre o assunto, não sobre o idioma. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tags', function (Blueprint $table): void {
            $table->id();
            $table->string('slug')->unique();
            $table->timestampsTz();
        });

        Schema::create('publication_tag', function (Blueprint $table): void {
            $table->foreignId('publication_id')->constrained()->cascadeOnDelete();
            $table->foreignId('tag_id')->constrained()->cascadeOnDelete();

            $table->primary(['publication_id', 'tag_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('publication_tag');
        Schema::dropIfExists('tags');
    }
};
