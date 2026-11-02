<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('members', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('handle', 30)->unique();
            $table->string('avatar_url')->nullable();
            $table->string('email')->nullable()->index();
            $table->timestampTz('email_verified_at')->nullable();
            $table->string('locale', 2)->default('pt');
            $table->timestampsTz();
            $table->softDeletesTz();
        });

        DB::statement("ALTER TABLE members ADD CONSTRAINT members_handle_format CHECK (handle ~ '^[a-z0-9_]{3,30}$')");

        Schema::create('member_identities', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('member_id')->constrained()->cascadeOnDelete();
            $table->string('provider', 20);
            $table->string('provider_user_id');
            $table->timestampsTz();

            $table->unique(['provider', 'provider_user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('member_identities');
        Schema::dropIfExists('members');
    }
};
