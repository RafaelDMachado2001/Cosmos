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

/** O centro da estrela e os diâmetros, nas proporções da prévia do protótipo (15% e 70%). */
const STAR_X = 960;
const STAR_Y = 270;
const STAR = 180;
const AURA = 840;

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
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '72px 80px',
        backgroundColor: token('color-bg'),
        fontFamily: 'Roboto',
      }}
    >
      {/* A estrela da categoria, como a prévia do RDM Studio a desenha: aura,
          e um núcleo que vai do branco à cor e some na borda. Atrás de tudo, à
          direita, onde o título (limitado em largura) não chega. */}
      <div
        style={{
          position: 'absolute',
          left: STAR_X - AURA / 2,
          top: STAR_Y - AURA / 2,
          width: AURA,
          height: AURA,
          borderRadius: 999,
          backgroundImage: `radial-gradient(circle, ${accent}33 0%, ${accent}0d 40%, transparent 70%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: STAR_X - STAR / 2,
          top: STAR_Y - STAR / 2,
          width: STAR,
          height: STAR,
          borderRadius: 999,
          backgroundImage: `radial-gradient(circle at 40% 36%, #ffffff 0%, ${accent} 44%, ${accent}00 78%)`,
          boxShadow: `0 0 80px 16px ${accent}55`,
        }}
      />
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
        {card.kicker}
      </div>

      <div
        style={{
          display: 'flex',
          maxWidth: 760,
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
