<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

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
