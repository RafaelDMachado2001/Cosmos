<?php

declare(strict_types=1);

namespace App\Modules\Identity;

use Illuminate\Support\ServiceProvider;

/**
 * O módulo de identidade: contas de leitor, login social e perfis.
 *
 * Não conhece o Content, e o Content não o conhece (deptrac.yaml). O que um
 * precisa saber do outro chega por evento de domínio.
 */
class IdentityServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        //
    }
}
