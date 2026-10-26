<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Modules\Content\Models\Publication;
use App\Modules\Content\Models\PublicationTranslation;
use Tests\TestCase;

/**
 * O vocabulário vem de config/publications.php, que é gerado do frontend.
 *
 * Os testes trocam o config em tempo de execução: se algum ponto ainda lesse
 * uma cópia escrita à mão, a troca não chegaria nele.
 */
class VocabularyTest extends TestCase
{
    public function test_idiomas_e_categorias_saem_do_config(): void
    {
        config([
            'publications.locales' => ['pt', 'en', 'es'],
            'publications.categories' => ['artigo', 'ensaio'],
        ]);

        $this->assertSame(['pt', 'en', 'es'], PublicationTranslation::locales());
        $this->assertSame(['artigo', 'ensaio'], Publication::categories());
    }

    public function test_a_api_valida_o_idioma_contra_o_config(): void
    {
        config(['publications.locales' => ['pt']]);

        $this->getJson('/api/publications?locale=en')->assertStatus(422);
    }

    public function test_a_api_valida_a_categoria_contra_o_config(): void
    {
        config(['publications.categories' => ['artigo']]);

        $this->getJson('/api/publications?category=projeto')->assertStatus(422);
    }
}
