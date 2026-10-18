/**
 * Encaixa a página pré-renderizada no HTML que o Vite emitiu.
 *
 * Fora de `main.ts` porque aquele módulo roda o prerender ao ser importado;
 * aqui é função pura, testável.
 */

import type { PrerenderedPage } from './pages';

/** O ponto onde a casca entra. `src/main.tsx` a remove quando o React monta. */
export const SLOT = '<div id="prerender"></div>';

const LANG = /<html lang="[^"]*">/;

/**
 * O que o template traz e o cabeçalho da rota substitui.
 *
 * Precisa sair antes, não depois: com dois `<title>` no documento vale o
 * primeiro, e o primeiro seria o genérico do `index.html` — cada artigo subiria
 * para o buscador com o título da tela de entrada. O mesmo vale para a
 * descrição.
 */
const TEMPLATE_TITLE = /[ \t]*<title>[\s\S]*?<\/title>\n?/;
const TEMPLATE_DESCRIPTION = /[ \t]*<meta\s+name="description"[\s\S]*?>\n?/;

/**
 * Toda substituição com conteúdo da página vai por função, nunca por string:
 * na string, `String.replace` lê `$&`, `$'`, `` $` `` e `$1` como padrões. Um
 * artigo com `$&` num bloco de código (regex, shell) colava ali o trecho do
 * template que estava sendo substituído — o `<script>` do bundle ia parar no
 * meio do texto.
 */
export function compose(template: string, page: PrerenderedPage, css: string): string {
  return template
    .replace(LANG, () => `<html lang="${page.lang}">`)
    .replace(TEMPLATE_TITLE, '')
    .replace(TEMPLATE_DESCRIPTION, '')
    .replace('</head>', () => `${page.head}\n<style data-head>${css}</style>\n</head>`)
    .replace(SLOT, () => `<div id="prerender">${page.body}</div>`);
}
