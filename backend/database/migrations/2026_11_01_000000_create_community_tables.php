<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('comments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('publication_id')->constrained()->cascadeOnDelete();
            $table->foreignId('member_id')->constrained()->restrictOnDelete();
            $table->string('locale', 5);
            $table->text('body')->nullable();
            $table->string('status', 20)->default('published');
            $table->timestampsTz();

            $table->index(['publication_id', 'locale', 'status', 'id']);
            $table->index('member_id');
        });

        Schema::create('reactions', function (Blueprint $table): void {
            $table->foreignId('publication_id')->constrained()->cascadeOnDelete();
            $table->foreignId('member_id')->constrained()->restrictOnDelete();
            $table->timestampTz('created_at')->useCurrent();

            $table->primary(['publication_id', 'member_id']);
            $table->index('member_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reactions');
        Schema::dropIfExists('comments');
    }
};
