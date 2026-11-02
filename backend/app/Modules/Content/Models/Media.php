<?php

declare(strict_types=1);

namespace App\Modules\Content\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $path
 * @property int $width
 * @property int $height
 * @property string $mime
 * @property string|null $alt_default
 */
class Media extends Model
{
    protected $table = 'media';

    protected $fillable = ['path', 'width', 'height', 'mime', 'alt_default'];
}
