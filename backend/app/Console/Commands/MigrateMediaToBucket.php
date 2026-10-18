<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\Media;
use App\Models\PublicationDraft;
use App\Models\PublicationTranslation;
use App\Support\SiteRebuild;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

/**
 * Leva a mídia do disco local para o bucket e reescreve as URLs que a citam.
 *
 * Roda uma vez, na virada para produção: até ali o upload gravava em
 * storage/app/public, e o Markdown publicado e os rascunhos guardam
 * `/storage/media/{uuid}.webp`. Idempotente — arquivo que já está no bucket
 * não é reenviado, e texto que já aponta para o bucket não tem mais o prefixo
 * antigo para trocar.
 */
class MigrateMediaToBucket extends Command
{
    protected $signature = 'media:migrate-to-r2';

    protected $description = 'Envia a mídia local ao bucket e reescreve /storage/media/ nos corpos e rascunhos';

    /** O prefixo que o disco local devolvia — raiz-relativo, por isso único. */
    private const string LOCAL_PREFIX = '/storage/media/';

    public function handle(): int
    {
        if (config('filesystems.disks.media.driver') !== 's3') {
            $this->error('MEDIA_DISK não é s3: não há bucket para onde migrar.');

            return self::FAILURE;
        }

        $local = Storage::disk('public');
        $bucket = Storage::disk('media');
        $target = rtrim($bucket->url('media'), '/').'/';

        $sent = 0;
        foreach (Media::all() as $media) {
            if ($bucket->exists($media->path) || ! $local->exists($media->path)) {
                continue;
            }
            $bucket->put($media->path, (string) $local->get($media->path), [
                'visibility' => 'public',
                'ContentType' => $media->mime,
                'CacheControl' => 'public, max-age=31536000, immutable',
            ]);
            $sent++;
        }

        $bodies = 0;
        foreach (PublicationTranslation::where('body', 'like', '%'.self::LOCAL_PREFIX.'%')->get() as $translation) {
            $rewritten = self::rewriteMarkdown($translation->body, $target);
            if ($rewritten !== $translation->body) {
                $translation->body = $rewritten;
                // Sem eventos: cada save dispararia uma regeneração. Uma só, no fim.
                $translation->saveQuietly();
                $bodies++;
            }
        }

        $drafts = 0;
        foreach (PublicationDraft::all() as $draft) {
            $blocks = self::rewriteBlocks($draft->blocks, $target);
            if ($blocks !== $draft->blocks) {
                $draft->blocks = $blocks;
                $draft->saveQuietly();
                $drafts++;
            }
        }

        if ($bodies > 0) {
            SiteRebuild::request();
        }

        $this->info("{$sent} arquivo(s) enviado(s), {$bodies} corpo(s) e {$drafts} rascunho(s) reescrito(s).");

        return self::SUCCESS;
    }

    /**
     * Só o alvo de imagem ou link — `](/storage/media/` —, nunca o texto
     * corrido nem uma URL de outro host que por acaso contenha o caminho.
     */
    public static function rewriteMarkdown(string $markdown, string $target): string
    {
        return str_replace('('.self::LOCAL_PREFIX, '('.$target, $markdown);
    }

    /**
     * @param  array<int, array<string, mixed>>  $blocks
     * @return array<int, array<string, mixed>>
     */
    public static function rewriteBlocks(array $blocks, string $target): array
    {
        return array_map(static function (array $block) use ($target): array {
            $url = $block['url'] ?? null;
            if (($block['type'] ?? null) === 'img' && is_string($url) && str_starts_with($url, self::LOCAL_PREFIX)) {
                $block['url'] = $target.substr($url, strlen(self::LOCAL_PREFIX));
            }

            return $block;
        }, $blocks);
    }
}
