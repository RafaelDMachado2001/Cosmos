<?php

declare(strict_types=1);

namespace App\Modules\Content\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Contracts\View\View;

class RdmStudioController extends Controller
{
    public function show(): View
    {
        return view('rdm-studio.app');
    }
}
