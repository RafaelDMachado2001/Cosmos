<?php

declare(strict_types=1);

namespace App\Modules\Content\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * O mesmo contrato de `DraftBlock` (`src/core/draftBlocks.ts`), validado em
 * PHP porque é aqui que a requisição chega. Cada tipo aceito pelo editor do
 * RDM Studio; nenhum outro passa.
 *
 * `img.url` passa pela mesma allow-list de `safeUrl` em `core/blocks.ts` —
 * porta do regex, não importação: o TypeScript não cruza para o PHP, e a
 * regra é pequena e estável o bastante para valer a duplicação.
 */
class ValidDraftBlocks implements ValidationRule
{
    private const array TYPES = ['p', 'h2', 'h3', 'quote', 'list', 'code', 'img'];

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
            'p', 'h2', 'h3', 'quote' => $this->requireNonEmptyString($attribute, $index, $block, 'text', $fail),
            'code' => $this->validateCode($attribute, $index, $block, $fail),
            'list' => $this->validateList($attribute, $index, $block, $fail),
            'img' => $this->validateImage($attribute, $index, $block, $fail),
        };
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

        // A linguagem vai na cerca de abertura do bloco; com espaço ou crase
        // a cerca deixa de ser reconhecida e o código vira parágrafo.
        if (is_string($block['lang'] ?? null) && preg_match('/[\s`]/', trim($block['lang'])) === 1) {
            $fail("{$attribute}.{$index}.lang não pode ter espaços nem crases.");
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

    /** @param array<string, mixed> $block */
    private function validateImage(string $attribute, int|string $index, array $block, Closure $fail): void
    {
        // Alt obrigatório: é o único texto que sobra para quem não vê a
        // imagem, e a spec do RDM Studio não abre excecão pra isso.
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

    /** O mesmo allow-list de `safeUrl` em `src/core/blocks.ts`. */
    public static function safeUrl(string $url): ?string
    {
        $trimmed = trim($url);

        if ($trimmed === '') {
            return null;
        }

        // `//host` e `/\host` o navegador lê como outro host (ver core/blocks.ts).
        if (preg_match('#^/(?![/\\\\])#', $trimmed) === 1 || str_starts_with($trimmed, '#')) {
            return $trimmed;
        }

        if (preg_match('/^(https?|mailto):/i', $trimmed) === 1) {
            return $trimmed;
        }

        return null;
    }
}
