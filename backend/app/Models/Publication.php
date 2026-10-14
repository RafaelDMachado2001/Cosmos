<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Publication extends Model
{
    use HasFactory;

    /** Só publicações com este status chegam à API pública. */
    public const string STATUS_PUBLISHED = 'published';

    public const string STATUS_DRAFT = 'draft';

    /**
     * As quatro do handoff. A constelação colore a estrela por elas.
     *
     * Lidas de config/publications.php, gerado de src/core/types.ts por
     * `npm run emit:seed`: uma cópia escrita à mão divergiria no primeiro ajuste.
     *
     * @return list<string>
     */
    public static function categories(): array
    {
        return config('publications.categories');
    }

    protected $fillable = ['slug', 'category', 'published_at', 'featured', 'status'];

    protected function casts(): array
    {
        return [
            'published_at' => 'immutable_datetime',
            'featured' => 'boolean',
        ];
    }

    public function translations(): HasMany
    {
        return $this->hasMany(PublicationTranslation::class);
    }
}
