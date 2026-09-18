<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PublicationTranslation extends Model
{
    use HasFactory;

    public const array LOCALES = ['pt', 'en'];

    protected $fillable = ['publication_id', 'locale', 'title', 'summary', 'body'];

    /**
     * Coluna gerada pelo Postgres. Listá-la aqui impede o Eloquent de tentar
     * escrevê-la num `update`, o que o banco recusaria.
     */
    protected $guarded = ['search_vector'];

    public function publication(): BelongsTo
    {
        return $this->belongsTo(Publication::class);
    }
}
