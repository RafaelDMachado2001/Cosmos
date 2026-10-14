/**
 * Desenha o cartão de Open Graph: JSX → SVG (satori) → PNG (resvg em wasm).
 *
 * Roda no Node, no prerender e no job de regeração. Wasm e não o binário nativo
 * do resvg: o binário é por plataforma, e o mesmo prerender roda no Alpine do
 * build, no Alpine do `queue` e no `node` do desenvolvimento.
 *
 * As cores saem de `tokens.css`, embutido no bundle como texto: o job roda em
 * /srv/render, onde `src/` não existe. As fontes são as mesmas da interface,
 * lidas do `node_modules`, que existe nos dois lugares.
 */

import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

import { Resvg, initWasm } from '@resvg/resvg-wasm';
import satori from 'satori';

import { monthYearLabel } from '../core/format';
import { OG_SIZE, parseTokens } from '../core/og';
import type { OgCard } from '../core/og';
import tokensCss from '../styles/tokens.css?raw';

const require = createRequire(import.meta.url);
const TOKENS = parseTokens(tokensCss);

function token(name: string): string {
  const value = TOKENS[name];
  if (value === undefined) throw new Error(`--${name} não está em tokens.css`);
  return value;
}

type Font = Parameters<typeof satori>[1]['fonts'][number];

let ready: Promise<readonly Font[]> | null = null;

/** Fontes e wasm, carregados uma vez por processo — o prerender desenha dezenas. */
function prepare(): Promise<readonly Font[]> {
  ready ??= (async () => {
    await initWasm(readFile(require.resolve('@resvg/resvg-wasm/index_bg.wasm')));
    const font = async (file: string, name: string, weight: 300 | 400 | 500): Promise<Font> => ({
      name,
      weight,
      style: 'normal',
      data: await readFile(require.resolve(file)),
    });
    return Promise.all([
      font('@fontsource/roboto/files/roboto-latin-300-normal.woff', 'Roboto', 300),
      font('@fontsource/roboto/files/roboto-latin-400-normal.woff', 'Roboto', 400),
      font('@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff', 'JetBrains Mono', 500),
    ]);
  })();
  return ready;
}

/** Um elemento, não um componente: satori o lê uma vez, sem React montando nada. */
function cardElement(card: OgCard) {
  const accent = token(card.category === undefined ? 'color-accent' : `color-cat-${card.category}`);
  const date = card.date === undefined ? null : monthYearLabel(Date.parse(card.date), card.locale);
  // Títulos longos descem um degrau em vez de serem cortados: o cartão é lido
  // num feed, e o título inteiro é o que faz alguém clicar.
  const titleSize = card.title.length > 48 ? 60 : 72;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '72px 80px',
        backgroundColor: token('color-bg'),
        backgroundImage: `radial-gradient(circle at 85% 20%, ${token('color-accent-wash')}, transparent 55%)`,
        fontFamily: 'Roboto',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          fontFamily: 'JetBrains Mono',
          fontSize: 24,
          letterSpacing: '0.34em',
          textTransform: 'uppercase',
          color: token('color-text-ui'),
        }}
      >
        <div style={{ width: 16, height: 16, borderRadius: 999, backgroundColor: accent }} />
        {card.kicker}
      </div>

      <div
        style={{
          display: 'flex',
          fontSize: titleSize,
          fontWeight: 300,
          lineHeight: 1.12,
          color: token('color-text-title'),
        }}
      >
        {card.title}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: 'JetBrains Mono',
          fontSize: 22,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: token('color-text-muted'),
          borderTop: `1px solid ${token('color-border-accent')}`,
          paddingTop: 28,
        }}
      >
        <span>RDM Labs / Cosmos</span>
        {date === null ? null : <span>{date}</span>}
      </div>
    </div>
  );
}

export async function ogSvg(card: OgCard): Promise<string> {
  const fonts = await prepare();
  return satori(cardElement(card), {
    width: OG_SIZE.width,
    height: OG_SIZE.height,
    fonts: [...fonts],
  });
}

export async function ogPng(card: OgCard): Promise<Buffer> {
  const svg = await ogSvg(card);
  return Buffer.from(new Resvg(svg, { fitTo: { mode: 'original' } }).render().asPng());
}
