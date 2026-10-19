<?php

declare(strict_types=1);

namespace App\Modules\Content\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Contracts\View\View;

/**
 * A casca HTML do RDM Studio — só o `<div id="admin-root">` e o script.
 *
 * Deliberadamente não é uma página do Filament (`Filament\Pages\Page`):
 * todo `Page` é um componente Livewire, e Livewire reivindica o DOM da sua
 * própria região para o protocolo de re-render dele. Montar o React do
 * RDM Studio dentro dessa região arriscaria os dois disputarem o mesmo
 * nó na primeira interação. Uma rota comum, atrás do mesmo guard `web`
 * que `/admin/api/*` já usa, não tem esse problema.
 */
class RdmStudioController extends Controller
{
    public function show(): View
    {
        return view('rdm-studio.app');
    }
}
