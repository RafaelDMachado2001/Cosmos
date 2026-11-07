<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tags', function (Blueprint $table): void {
            $table->string('locale', 5)->default('pt');
            $table->dropUnique(['slug']);
            $table->unique(['locale', 'slug']);
        });

        DB::statement('ALTER TABLE tags ALTER COLUMN locale DROP DEFAULT');

        DB::statement("
            INSERT INTO tags (slug, locale, created_at, updated_at)
            SELECT slug, 'en', created_at, updated_at FROM tags WHERE locale = 'pt'
        ");

        DB::statement("
            INSERT INTO publication_tag (publication_id, tag_id)
            SELECT link.publication_id, en.id
            FROM publication_tag link
            JOIN tags pt ON pt.id = link.tag_id
            JOIN tags en ON en.slug = pt.slug AND en.locale = 'en'
        ");
    }

    public function down(): void
    {
        DB::statement("DELETE FROM tags WHERE locale <> 'pt'");

        Schema::table('tags', function (Blueprint $table): void {
            $table->dropUnique(['locale', 'slug']);
            $table->dropColumn('locale');
            $table->unique('slug');
        });
    }
};
