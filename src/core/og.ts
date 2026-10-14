/**
 * O cartão de Open Graph: o que ele desenha e onde ele mora.
 *
 * O nome do arquivo é um hash de tudo o que o cartão desenha, então a mesma
 * função serve ao prerender, que grava a imagem, e ao cliente, que troca o
 * cabeçalho ao navegar — os dois chegam ao mesmo endereço sem conversar. E o
 * que não mudou não é redesenhado: o arquivo já existe com aquele nome.
 *
 * Módulo puro: sem DOM, sem React, sem Three.
 */

import { fnv1a32 } from './hash';
import type { Category, Locale } from './types';

/** O tamanho que os cartões grandes do Open Graph esperam. */
export const OG_SIZE = { width: 1200, height: 630 } as const;

/**
 * Versão do desenho. Mudar o layout do cartão sem mudar isto deixaria no ar as
 * imagens antigas, porque o nome não mudaria.
 */
const OG_DESIGN = 1;

export interface OgCard {
  readonly locale: Locale;
  readonly title: string;
  /** A linha pequena acima do título: a categoria, ou o nome do site na home. */
  readonly kicker: string;
  /** Pinta o acento. Sem categoria, o cartão usa o roxo do site. */
  readonly category?: Category;
  /** ISO 8601, só a data. */
  readonly date?: string;
}

export function ogImagePath(card: OgCard): string {
  const drawn = JSON.stringify([
    OG_DESIGN,
    card.locale,
    card.kicker,
    card.title,
    card.category ?? '',
    card.date ?? '',
  ]);
  const hash = fnv1a32(drawn).toString(16).padStart(8, '0');
  return `/og/${card.locale}-${hash}.png`;
}

/**
 * As propriedades customizadas de `tokens.css`, sem o `--`.
 *
 * O cartão não inventa cor: lê as mesmas variáveis que a interface e a cena 3D
 * leem, só que do arquivo, porque aqui não existe navegador para resolvê-las.
 */
export function parseTokens(css: string): Readonly<Record<string, string>> {
  const tokens: Record<string, string> = {};
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const match of withoutComments.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    const [, name, value] = match;
    if (name !== undefined && value !== undefined) tokens[name] = value.trim();
  }
  return tokens;
}
