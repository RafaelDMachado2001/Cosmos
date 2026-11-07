<?php

declare(strict_types=1);

namespace App\Modules\Content\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class ValidDraftBlocks implements ValidationRule
{
    private const array TYPES = ['p', 'h2', 'h3', 'quote', 'list', 'code', 'img', 'table', 'highlight', 'note', 'flow', 'diagram'];

    private const array ALIGNS = ['left', 'center', 'right'];

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_array($value)) {
            $fail("{$attribute} precisa ser uma lista de blocos.");

            return;
        }

        foreach ($value as $index => $block) {
            $this->validateBlock($attribute, $index, $block, $fail);
        }
    }

    private function validateBlock(string $attribute, int|string $index, mixed $block, Closure $fail): void
    {
        if (! is_array($block)) {
            $fail("{$attribute}.{$index} precisa ser um objeto.");

            return;
        }

        $type = $block['type'] ?? null;

        if (! in_array($type, self::TYPES, true)) {
            $fail("{$attribute}.{$index}.type precisa ser um de: ".implode(', ', self::TYPES).'.');

            return;
        }

        if (! isset($block['id']) || ! is_string($block['id']) || $block['id'] === '') {
            $fail("{$attribute}.{$index}.id é obrigatório.");

            return;
        }

        match ($type) {
            'p', 'h2', 'h3', 'quote', 'highlight' => $this->requireNonEmptyString($attribute, $index, $block, 'text', $fail),
            'note' => $this->validateNote($attribute, $index, $block, $fail),
            'flow' => $this->validateFlow($attribute, $index, $block, $fail),
            'code' => $this->validateCode($attribute, $index, $block, $fail),
            'list' => $this->validateList($attribute, $index, $block, $fail),
            'img' => $this->validateImage($attribute, $index, $block, $fail),
            'table' => $this->validateTable($attribute, $index, $block, $fail),
            'diagram' => $this->validateDiagram($attribute, $index, $block, $fail),
        };
    }

    /** @param array<string, mixed> $block */
    private function validateDiagram(string $attribute, int|string $index, array $block, Closure $fail): void
    {
        $this->requireNonEmptyString($attribute, $index, $block, 'source', $fail);

        $max = config()->integer('diagrams.source_max_length');
        if (is_string($block['source'] ?? null) && mb_strlen($block['source']) > $max) {
            $fail("{$attribute}.{$index}.source aceita até {$max} caracteres.");
        }
    }

    /** @param array<string, mixed> $block */
    private function validateCode(string $attribute, int|string $index, array $block, Closure $fail): void
    {
        if (! isset($block['text']) || ! is_string($block['text'])) {
            $fail("{$attribute}.{$index}.text é obrigatório.");

            return;
        }

        if (array_key_exists('lang', $block) && $block['lang'] !== null && ! is_string($block['lang'])) {
            $fail("{$attribute}.{$index}.lang precisa ser texto ou nulo.");

            return;
        }

        if (is_string($block['lang'] ?? null) && preg_match('/[\s`]/', trim($block['lang'])) === 1) {
            $fail("{$attribute}.{$index}.lang não pode ter espaços nem crases.");

            return;
        }

        $this->optionalString($attribute, $index, $block, 'filename', 255, $fail);
    }

    /** @param array<string, mixed> $block */
    private function validateNote(string $attribute, int|string $index, array $block, Closure $fail): void
    {
        $this->requireNonEmptyString($attribute, $index, $block, 'text', $fail);
        $this->optionalString($attribute, $index, $block, 'title', 255, $fail);
    }

    /**
     * @param  array<string, mixed>  $block
     */
    private function validateFlow(string $attribute, int|string $index, array $block, Closure $fail): void
    {
        $steps = $block['steps'] ?? null;
        if (! is_array($steps) || ! array_is_list($steps) || count($steps) < 2) {
            $fail("{$attribute}.{$index}.steps precisa de ao menos duas etapas.");

            return;
        }

        foreach ($steps as $stepIndex => $step) {
            if (! is_string($step) || trim($step) === '') {
                $fail("{$attribute}.{$index}.steps.{$stepIndex} precisa ser texto não vazio.");

                return;
            }
        }
    }

    /** @param array<string, mixed> $block */
    private function optionalString(
        string $attribute,
        int|string $index,
        array $block,
        string $field,
        int $max,
        Closure $fail,
    ): void {
        $value = $block[$field] ?? null;
        if ($value !== null && (! is_string($value) || mb_strlen($value) > $max)) {
            $fail("{$attribute}.{$index}.{$field} precisa ser texto de até {$max} caracteres ou nulo.");
        }
    }

    /** @param array<string, mixed> $block */
    private function validateList(string $attribute, int|string $index, array $block, Closure $fail): void
    {
        if (! isset($block['ordered']) || ! is_bool($block['ordered'])) {
            $fail("{$attribute}.{$index}.ordered precisa ser verdadeiro ou falso.");

            return;
        }

        if (! isset($block['items']) || ! is_array($block['items']) || $block['items'] === []) {
            $fail("{$attribute}.{$index}.items precisa ter ao menos um item.");

            return;
        }

        foreach ($block['items'] as $itemIndex => $item) {
            if (! is_string($item) || trim($item) === '') {
                $fail("{$attribute}.{$index}.items.{$itemIndex} precisa ser texto não vazio.");

                return;
            }
        }
    }

    /**
     * @param  array<string, mixed>  $block
     */
    private function validateTable(string $attribute, int|string $index, array $block, Closure $fail): void
    {
        $align = $block['align'] ?? null;
        if (! is_array($align) || $align === [] || ! array_is_list($align)) {
            $fail("{$attribute}.{$index}.align precisa ter ao menos uma coluna.");

            return;
        }

        foreach ($align as $value) {
            if ($value !== null && ! in_array($value, self::ALIGNS, true)) {
                $fail("{$attribute}.{$index}.align aceita left, center, right ou nulo.");

                return;
            }
        }

        $header = $block['header'] ?? null;
        $rows = $block['rows'] ?? null;
        if (! is_array($rows) || ! array_is_list($rows)) {
            $fail("{$attribute}.{$index}.rows precisa ser uma lista de linhas.");

            return;
        }

        foreach ([$header, ...$rows] as $row) {
            if (! is_array($row) || count($row) !== count($align)) {
                $fail("{$attribute}.{$index} precisa de uma célula por coluna em toda linha.");

                return;
            }

            foreach ($row as $cell) {
                if ($cell !== null && ! is_string($cell)) {
                    $fail("{$attribute}.{$index} só aceita texto nas células.");

                    return;
                }
            }
        }

        /** @var list<string|null> $header */
        if (trim(implode('', array_map(strval(...), $header))) === '') {
            $fail("{$attribute}.{$index}.header não pode ser todo vazio.");
        }
    }

    /** @param array<string, mixed> $block */
    private function validateImage(string $attribute, int|string $index, array $block, Closure $fail): void
    {
        if (! isset($block['alt']) || ! is_string($block['alt']) || trim($block['alt']) === '') {
            $fail("{$attribute}.{$index}.alt é obrigatório.");

            return;
        }

        if (! isset($block['url']) || ! is_string($block['url']) || self::safeUrl($block['url']) === null) {
            $fail("{$attribute}.{$index}.url precisa ser http(s), raiz-relativo ou âncora.");

            return;
        }

        if (array_key_exists('mediaId', $block) && $block['mediaId'] !== null && ! is_int($block['mediaId'])) {
            $fail("{$attribute}.{$index}.mediaId precisa ser inteiro ou nulo.");

            return;
        }

        if (array_key_exists('caption', $block) && $block['caption'] !== null && ! is_string($block['caption'])) {
            $fail("{$attribute}.{$index}.caption precisa ser texto ou nulo.");
        }
    }

    /** @param array<string, mixed> $block */
    private function requireNonEmptyString(
        string $attribute,
        int|string $index,
        array $block,
        string $field,
        Closure $fail,
    ): void {
        if (! isset($block[$field]) || ! is_string($block[$field]) || trim($block[$field]) === '') {
            $fail("{$attribute}.{$index}.{$field} é obrigatório.");
        }
    }

    /**
     * @param  array<int, array<string, mixed>>  $blocks
     * @return array<int, array<string, mixed>>
     */
    public static function normalizeTables(array $blocks): array
    {
        return array_map(function (array $block): array {
            if (($block['type'] ?? null) !== 'table') {
                return $block;
            }

            $cells = fn (array $row): array => array_map(fn (mixed $cell): string => (string) $cell, $row);
            $block['header'] = $cells($block['header']);
            $block['rows'] = array_map($cells, $block['rows']);

            return $block;
        }, $blocks);
    }

    public static function safeUrl(string $url): ?string
    {
        $trimmed = trim($url);

        if ($trimmed === '') {
            return null;
        }

        if (preg_match('#^/(?![/\\\\])#', $trimmed) === 1 || str_starts_with($trimmed, '#')) {
            return $trimmed;
        }

        if (preg_match('/^(https?|mailto):/i', $trimmed) === 1) {
            return $trimmed;
        }

        return null;
    }
}
