<?php

declare(strict_types=1);

namespace App\Modules\Content\Support;

use Symfony\Component\Process\Exception\ProcessFailedException;
use Symfony\Component\Process\Process;

class DraftBlocksCli
{
    private const int TIMEOUT_SECONDS = 60;

    /**
     * @return list<array<string, mixed>>
     */
    public static function toBlocks(string $markdown): array
    {
        $output = self::run('markdown-to-blocks', $markdown);

        /** @var list<array<string, mixed>> */
        return json_decode($output, true, flags: JSON_THROW_ON_ERROR);
    }

    /**
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
