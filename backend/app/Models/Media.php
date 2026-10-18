<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Uma imagem enviada pelo RDM Studio. `width`/`height` vêm do upload, não de
 * uma leitura posterior do arquivo — é o que permite a página pública
 * reservar o espaço certo sem decodificar a imagem.
 *
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
