<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Os leitores com conta (módulo Identity), separados de `users`, que é só o
 * admin.
 *
 * A conta se liga ao provedor pelo id dele, nunca pelo e-mail: e-mail muda,
 * e uma conta de leitor não é um allowlist de um endereço como a do admin.
 * O e-mail fica para contato e para a ligação entre provedores (D5).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('members', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('handle', 30)->unique();
            $table->string('avatar_url')->nullable();
            // Nulos depois da anonimização (DELETE /api/me).
            $table->string('email')->nullable()->index();
            $table->timestampTz('email_verified_at')->nullable();
            $table->string('locale', 2)->default('pt');
            $table->timestampsTz();
            $table->softDeletesTz();
        });

        // A mesma regra de Handle::PATTERN, para nada escrever fora dela.
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
