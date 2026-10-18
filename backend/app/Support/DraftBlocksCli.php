<?php

declare(strict_types=1);

namespace App\Support;

use Symfony\Component\Process\Exception\ProcessFailedException;
use Symfony\Component\Process\Process;

/**
 * A ponte com `scripts/draft-blocks-cli.ts` (compilado em
 * `dist-ssr/draft-blocks-cli.js` por `vite.prerender.config.ts`). A gramática
 * de blocos mora em TypeScript puro (`core/draftBlocks.ts`); isto só chama o
 * binário já compilado por `Process`, mesmo padrão de `RegenerateSite.php`.
 */
class DraftBlocksCli
{
    /**
     * Generoso de propósito: sem `pcntl`, o Process espera por polling, e uma
     * suíte que chama isto muitas vezes em sequência (cada chamada paga a
     * inicialização do Node) ocasionalmente passou de 30s sob carga — nunca
     * por um bloco real, sempre pela fila de processos na frente dele.
     */
    private const int TIMEOUT_SECONDS = 60;

    /**
     * Markdown publicado -> blocos do editor. Só usado pela migração de dados.
     *
     * @return list<array<string, mixed>>
     */
    public static function toBlocks(string $markdown): array
    {
        $output = self::run('markdown-to-blocks', $markdown);

        /** @var list<array<string, mixed>> */
        return json_decode($output, true, flags: JSON_THROW_ON_ERROR);
    }

    /**
     * Blocos do editor -> o Markdown que `publication_translations.body` guarda.
     *
     * @param  array<int, array<string, mixed>>  $blocks
     */
    public static function toMarkdown(array $blocks): string
    {
        return self::run('blocks-to-markdown', json_encode($blocks, JSON_THROW_ON_ERROR));
    }

    private static function run(string $command, string $input): string
    {
        $process = new Process(
            ['node', 'dist-ssr/draft-blocks-cli.js', $command],
            config('publishing.render_dir'),
            null,
            $input,
            self::TIMEOUT_SECONDS,
        );
        $process->run();

        if (! $process->isSuccessful()) {
            throw new ProcessFailedException($process);
        }

        return $process->getOutput();
    }
}
