<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Modules\Content\Models\Media;
use App\Modules\Content\Models\Publication;
use App\Modules\Content\Models\PublicationDraft;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MigrateMediaToBucketTest extends TestCase
{
    use RefreshDatabase;

    private const string BODY = "Antes.\n\n![um](/storage/media/a.webp)\n\n![de novo](/storage/media/a.webp \"legenda\")\n\n"
        .'[externo](https://example.com/storage/media/a.webp) e o caminho /storage/media/ citado no texto.';

    private function publication(): Publication
    {
        $publication = Publication::create([
            'slug' => 'com-imagem',
            'category' => 'artigo',
            'published_at' => now()->subDay(),
            'featured' => false,
            'status' => Publication::STATUS_PUBLISHED,
        ]);
        $publication->translations()->create(['locale' => 'pt', 'title' => 'T', 'summary' => 'R', 'body' => self::BODY]);
        PublicationDraft::create([
            'publication_id' => $publication->id,
            'locale' => 'pt',
            'title' => 'T',
            'blocks' => [
                ['id' => 'b0', 'type' => 'img', 'url' => '/storage/media/a.webp', 'mediaId' => 1, 'alt' => '', 'caption' => null],
                ['id' => 'b1', 'type' => 'img', 'url' => 'https://example.com/x.png', 'mediaId' => null, 'alt' => '', 'caption' => null],
                ['id' => 'b2', 'type' => 'p', 'text' => 'Texto com /storage/media/a.webp no meio.'],
            ],
        ]);

        return $publication;
    }

    public function test_envia_os_arquivos_e_reescreve_so_os_alvos_de_imagem(): void
    {
        config(['filesystems.disks.media.driver' => 's3']);
        Storage::fake('public');
        Storage::fake('media', ['url' => 'https://media.rdmlabs.test']);
        Storage::disk('public')->put('media/a.webp', 'RIFF');
        Media::create(['path' => 'media/a.webp', 'width' => 10, 'height' => 10, 'mime' => 'image/webp']);
        $publication = $this->publication();

        $this->artisan('media:migrate-to-r2')->assertSuccessful();

        Storage::disk('media')->assertExists('media/a.webp');

        $body = $publication->translations()->firstOrFail()->body;
        $this->assertSame(2, substr_count($body, '(https://media.rdmlabs.test/media/a.webp'));
        // Link de outro host e texto corrido ficam como estavam.
        $this->assertStringContainsString('(https://example.com/storage/media/a.webp)', $body);
        $this->assertStringContainsString('o caminho /storage/media/ citado', $body);

        $blocks = PublicationDraft::firstOrFail()->blocks;
        $this->assertSame('https://media.rdmlabs.test/media/a.webp', $blocks[0]['url']);
        $this->assertSame('https://example.com/x.png', $blocks[1]['url']);
        $this->assertSame('Texto com /storage/media/a.webp no meio.', $blocks[2]['text']);

        // Idempotente: a segunda volta não acha nada para fazer.
        $this->artisan('media:migrate-to-r2')
            ->expectsOutput('0 arquivo(s) enviado(s), 0 corpo(s) e 0 rascunho(s) reescrito(s).')
            ->assertSuccessful();
    }

    public function test_recusa_quando_o_disco_nao_e_um_bucket(): void
    {
        $this->artisan('media:migrate-to-r2')->assertFailed();
    }
}
