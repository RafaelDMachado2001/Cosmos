<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

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

        DB::statement('CREATE INDEX publications_published_at_desc_index ON publications (published_at DESC)');
        DB::statement('CREATE INDEX publications_category_published_at_index ON publications (category, published_at DESC)');
    }

    public function down(): void
    {
        Schema::dropIfExists('publications');
    }
};
